param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Email = "user@example.com",
  [string]$Identity = "user@example.com",
  [string]$OtpCode = "000000",
  [string]$ResetProofToken = ""
)

function Invoke-TestRequest {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Body = @{}
  )

  $jsonBody = $Body | ConvertTo-Json
  try {
    $res = Invoke-WebRequest -Uri $Url -Method $Method -ContentType "application/json" -Body $jsonBody -UseBasicParsing
    Write-Output "[$Method] $Url -> $($res.StatusCode)"
    if ($res.Content) {
      Write-Output $res.Content
    }
  } catch {
    if ($_.Exception.Response) {
      $resp = $_.Exception.Response
      Write-Output "[$Method] $Url -> $([int]$resp.StatusCode)"
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $content = $reader.ReadToEnd()
      if ($content) {
        Write-Output $content
      }
    } else {
      Write-Output "[$Method] $Url -> ERROR: $($_.Exception.Message)"
    }
  }
  Write-Output ""
}

Write-Output "=== OTP Register Send ==="
Invoke-TestRequest -Method "POST" -Url "$BaseUrl/auth/otp/register/send" -Body @{ email = $Email }

Write-Output "=== OTP Forgot Password Send ==="
Invoke-TestRequest -Method "POST" -Url "$BaseUrl/auth/otp/forgot-password/send" -Body @{ identity = $Identity }

Write-Output "=== OTP Forgot Password Verify ==="
Invoke-TestRequest -Method "POST" -Url "$BaseUrl/auth/otp/forgot-password/verify" -Body @{ identity = $Identity; otpCode = $OtpCode }

if ($ResetProofToken) {
  Write-Output "=== Forgot Password Reset ==="
  Invoke-TestRequest -Method "POST" -Url "$BaseUrl/auth/forgot-password/reset" -Body @{ resetProofToken = $ResetProofToken; newPassword = "PasswordBaru123!" }
}
