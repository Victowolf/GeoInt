# build_lambda_package.ps1
#
# Builds the lambda_package/ folder: installs all Python dependencies
# needed by main.py/orchestrator.py/memory.py (and everything they import)
# directly into the folder, then copies the app's own source files in
# alongside them. The result is a self-contained folder AWS Lambda can run
# as-is - either zipped for manual console upload, or deployed via
# `sam deploy` using template.yaml, once AWS account access is available.
#
# Run this from the Sentinel project root:
#   .\build_lambda_package.ps1

$ErrorActionPreference = "Stop"

$PackageDir = "lambda_package"

Write-Host "Cleaning old package dir (if any)..."
Remove-Item -Recurse -Force $PackageDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $PackageDir | Out-Null

Write-Host "Installing dependencies into $PackageDir ..."
pip install --target $PackageDir `
    fastapi `
    mangum `
    pg8000 `
    fastembed `
    groq `
    requests `
    python-dotenv `
    pydantic `
    httpx

Write-Host "Copying app source files..."
$AppFiles = @(
    "main.py", "routes.py", "orchestrator.py", "models.py", "memory.py",
    "advisory.py", "money.py", "geocode.py", "config.py",
    "agent1.py", "agent2.py", "agent3.py", "agent4.py", "agent5.py"
)
foreach ($f in $AppFiles) {
    if (Test-Path $f) {
        Copy-Item $f -Destination $PackageDir
    } else {
        Write-Warning "Expected file not found, skipped: $f"
    }
}

if (Test-Path "prompts") {
    Write-Host "Copying prompts/ folder..."
    Copy-Item -Recurse "prompts" -Destination "$PackageDir\prompts"
}

Write-Host "Package build complete: .\$PackageDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  Option A (SAM, once AWS access exists):"
Write-Host "    sam deploy --guided"
Write-Host ""
Write-Host "  Option B (manual zip + console upload):"
Write-Host "    Compress-Archive -Path .\$PackageDir\* -DestinationPath .\sentinel_lambda.zip"
Write-Host "    (then upload sentinel_lambda.zip via Lambda console -> Create function -> Upload from .zip)"

$zipSizeCheck = Get-ChildItem $PackageDir -Recurse | Measure-Object -Property Length -Sum
$sizeMB = [math]::Round($zipSizeCheck.Sum / 1MB, 1)
Write-Host ""
Write-Host "Uncompressed package size: ~$sizeMB MB (Lambda's unzipped limit is 250 MB)"
if ($sizeMB -gt 200) {
    Write-Warning "Package is close to Lambda's 250MB unzipped limit - if it exceeds this, upload via S3 instead of direct .zip (see DEPLOY.md)."
}
