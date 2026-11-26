terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
  # Recommended: keep state in S3 (create the bucket once, then uncomment)
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "baba/production.tfstate"
  #   region = "eu-west-2"
  # }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "baba", Environment = var.environment }
  }
}

# CloudFront certificates must live in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { Project = "baba", Environment = var.environment }
  }
}
