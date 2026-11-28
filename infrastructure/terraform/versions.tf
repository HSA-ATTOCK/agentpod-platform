terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
  # State lives in an S3 bucket you create once (see docs/DEPLOYMENT_GUIDE.md, C1), so it
  # isn't lost with a Codespace or laptop. Pass the bucket when initialising:
  #   terraform init -backend-config="bucket=<state-bucket>" -backend-config="key=baba/production.tfstate" -backend-config="region=us-east-1"
  backend "s3" {
    encrypt = true
  }
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
