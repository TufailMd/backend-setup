export function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


export function getOtpHtml(otp) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <div style="text-align: center;">
        <h1>OTP Verification</h1>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>Please use this OTP to verify your account.</p>
    </div>
</body>
</html>`;
}

