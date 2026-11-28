output "ecr_repository_url" {
  description = "Push the app image here (the deploy workflow does it)"
  value       = aws_ecr_repository.app.repository_url
}

output "app_secret_name" {
  description = "Fill this Secrets Manager secret with your server settings (JSON) before the first deploy"
  value       = aws_secretsmanager_secret.app.name
}

output "load_balancer_dns" {
  description = "Point app_domain here (CNAME) if you don't use Route 53"
  value       = aws_lb.app.dns_name
}

output "sites_cloudfront_domain" {
  description = "Point *.sites_domain here (CNAME) if you don't use Route 53"
  value       = aws_cloudfront_distribution.sites.domain_name
}

output "certificate_dns_records" {
  description = "Without Route 53: add these CNAME records so AWS can issue the HTTPS certificates"
  value = concat(
    [for o in aws_acm_certificate.app.domain_validation_options : { name = o.resource_record_name, value = o.resource_record_value }],
    [for o in aws_acm_certificate.sites.domain_validation_options : { name = o.resource_record_name, value = o.resource_record_value }],
  )
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "sites_bucket" {
  value = aws_s3_bucket.sites.bucket
}

output "sites_oac_id" {
  description = "SITES_OAC_ID for the app (customers' own domains), if you run the app outside this ECS setup"
  value       = aws_cloudfront_origin_access_control.sites.id
}

output "github_deploy_role_arn" {
  description = "Save as the GitHub repository secret AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_deploy.arn
}

output "github_variables" {
  description = "Add these as GitHub repository variables (Settings → Secrets and variables → Actions → Variables)"
  value = {
    AWS_REGION         = var.region
    ECR_REPOSITORY_URL = aws_ecr_repository.app.repository_url
    ECS_CLUSTER        = aws_ecs_cluster.main.name
    APP_URL            = "https://${var.app_domain}"
  }
}
