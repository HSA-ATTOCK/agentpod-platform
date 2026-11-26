# ---------------------------------------------------------------------------
# Live customer websites: private S3 bucket behind CloudFront.
# https://<slug>.<sites_domain>/about.html is served from s3://bucket/<slug>/about.html
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "sites" {
  bucket_prefix = "baba-sites-${var.environment}-"
}

resource "aws_s3_bucket_public_access_block" "sites" {
  bucket                  = aws_s3_bucket.sites.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "sites" {
  bucket = aws_s3_bucket.sites.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "sites" {
  bucket = aws_s3_bucket.sites.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "sites" {
  name                              = "baba-sites-${var.environment}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Maps the subdomain to the site's folder: acme123.sites.example.com/about -> /acme123/about.html
resource "aws_cloudfront_function" "site_router" {
  name    = "baba-site-router-${var.environment}"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var host = request.headers.host ? request.headers.host.value : "";
      var site = host.split(".")[0];
      if (!/^[a-z0-9]{16,40}$/.test(site)) {
        return { statusCode: 404, statusDescription: "Not Found" };
      }
      var uri = request.uri;
      if (uri.endsWith("/")) {
        uri += "index.html";
      } else if (uri.split("/").pop().indexOf(".") === -1) {
        uri += ".html";
      }
      request.uri = "/" + site + uri;
      return request;
    }
  JS
}

resource "aws_acm_certificate" "sites" {
  provider          = aws.us_east_1
  domain_name       = "*.${var.sites_domain}"
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "sites_cert_validation" {
  for_each = var.route53_zone_id == "" ? {} : {
    for o in aws_acm_certificate.sites.domain_validation_options : o.domain_name => o
  }
  zone_id = var.route53_zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 300
}

resource "aws_acm_certificate_validation" "sites" {
  count                   = var.route53_zone_id == "" ? 0 : 1
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.sites.arn
  validation_record_fqdns = [for r in aws_route53_record.sites_cert_validation : r.fqdn]
}

resource "aws_cloudfront_distribution" "sites" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Baba live websites (${var.environment})"
  aliases         = ["*.${var.sites_domain}"]
  price_class     = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.sites.bucket_regional_domain_name
    origin_id                = "sites-bucket"
    origin_access_control_id = aws_cloudfront_origin_access_control.sites.id
  }

  default_cache_behavior {
    target_origin_id       = "sites-bucket"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # AWS managed policies: CachingOptimized, and SecurityHeadersPolicy
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.site_router.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.route53_zone_id == "" ? aws_acm_certificate.sites.arn : aws_acm_certificate_validation.sites[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# Only CloudFront may read the bucket
resource "aws_s3_bucket_policy" "sites" {
  bucket = aws_s3_bucket.sites.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.sites.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.sites.arn } }
    }]
  })
}

resource "aws_route53_record" "sites_wildcard" {
  count   = var.route53_zone_id == "" ? 0 : 1
  zone_id = var.route53_zone_id
  name    = "*.${var.sites_domain}"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.sites.domain_name
    zone_id                = aws_cloudfront_distribution.sites.hosted_zone_id
    evaluate_target_health = false
  }
}

# The app's permission to publish sites: write to the bucket and refresh CloudFront, nothing else
data "aws_iam_policy_document" "publish_sites" {
  statement {
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.sites.arn}/*"]
  }
  statement {
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.sites.arn]
  }
}

resource "aws_iam_policy" "publish_sites" {
  name   = "baba-publish-sites-${var.environment}"
  policy = data.aws_iam_policy_document.publish_sites.json
}
