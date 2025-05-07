# Upload artifact to custom API ✈️

Reusable GitHub Action that

1. **downloads** an artifact produced by a previous job
2. **POSTs** it to your backend (`api_url`) with a bearer token
3. (optionally) **waits** until the backend finishes a long-running task and returns `succeeded` or `failed`.

Perfect for pipelines that must ship a build bundle to an internal deploy-service, upload to S3, run end-to-end tests, etc.

[![Test](https://github.com/your-org/upload-artifact-to-api/actions/workflows/test.yml/badge.svg)](https://github.com/your-org/upload-artifact-to-api/actions/workflows/test.yml)
[![GitHub release](https://img.shields.io/github/v/tag/your-org/upload-artifact-to-api?label=version)](https://github.com/your-org/upload-artifact-to-api/releases)
![License](https://img.shields.io/github/license/your-org/upload-artifact-to-api)

---

## 📦 Inputs

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `artifact_name` | **yes** | – | Name of the artifact to download (must be uploaded earlier in the workflow). |
| `api_url` | **yes** | – | Full URL of your backend’s upload endpoint. |
| `api_token` | **yes** | – | Bearer token passed in `Authorization: Bearer …` header. |
| `poll` | no | `true` | `true` → wait until backend reports final status.<br>`false` → exit after upload. |
| `poll_interval_seconds` | no | `15` | Seconds between status checks when polling. |
| `poll_timeout_minutes` | no | `30` | Fail after this many minutes (0 = unlimited). |

## 🔄 Outputs

| Name | When `poll = true` | Description |
|------|--------------------|-------------|
| `result` | always | `"success"` or `"failure"` (mirrors backend result). |

---

## 🚀 Quick start

```yaml
name: build-and-deploy

permissions: contents:read  #  only basic permissions needed

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          npm ci && npm run build
          zip -r webapp.zip dist/
      - uses: actions/upload-artifact@v4
        with:
          name: webapp_bundle
          path: webapp.zip

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Ship bundle to backend and wait
        uses: your-org/upload-artifact-to-api@v1
        with:
          artifact_name: webapp_bundle
          api_url:       ${{ secrets.DEPLOY_API_URL }}/upload
          api_token:     ${{ secrets.UPLOAD_TOKEN }}
