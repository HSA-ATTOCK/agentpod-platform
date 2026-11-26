variable "region" {
  description = "AWS region for the app (e.g. eu-west-2)"
  type        = string
}

variable "environment" {
  description = "development, staging or production (separate state and resources for each)"
  type        = string
  default     = "production"
}

variable "app_domain" {
  description = "Where the app runs, e.g. app.example.com"
  type        = string
}

variable "sites_domain" {
  description = "Parent domain for live customer websites, e.g. sites.example.com (each site gets <id>.sites.example.com)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone for your domain. Leave empty to create the DNS records yourself (see outputs)."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Tag of the image in ECR to run (pushed by the deploy workflow)"
  type        = string
  default     = "latest"
}

variable "desired_count" {
  description = "How many app containers to run (2+ for high availability; workflow runs are claimed safely)"
  type        = number
  default     = 1
}

variable "cpu" {
  type    = number
  default = 1024
}

variable "memory" {
  type    = number
  default = 2048
}
