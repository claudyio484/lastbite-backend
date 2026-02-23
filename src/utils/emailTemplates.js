const verificationOtpEmail = (otp, firstName) => ({
  subject: 'Verify your LastBite account',
  html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #0d9488;">LastBite</span>
      </div>
      <h2 style="color: #1c1917; font-size: 20px; margin-bottom: 8px;">Welcome, ${firstName}!</h2>
      <p style="color: #57534e; font-size: 15px; line-height: 1.5;">Use the verification code below to confirm your email address:</p>
      <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; text-align: center;
                  background: #f0fdfa; color: #0d9488; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #ccfbf1;">
        ${otp}
      </div>
      <p style="color: #a8a29e; font-size: 13px; text-align: center;">This code expires in 10 minutes.</p>
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
      <p style="color: #a8a29e; font-size: 12px; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
  `,
});

const passwordResetEmail = (resetUrl, firstName) => ({
  subject: 'Reset your LastBite password',
  html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #0d9488;">LastBite</span>
      </div>
      <h2 style="color: #1c1917; font-size: 20px; margin-bottom: 8px;">Password Reset</h2>
      <p style="color: #57534e; font-size: 15px; line-height: 1.5;">Hi ${firstName}, we received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #0d9488; color: #ffffff;
                                      padding: 14px 36px; border-radius: 8px; text-decoration: none;
                                      font-weight: 600; font-size: 15px;">
          Reset Password
        </a>
      </div>
      <p style="color: #a8a29e; font-size: 13px; text-align: center;">This link expires in 1 hour.</p>
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
      <p style="color: #a8a29e; font-size: 12px;">Or copy this link: <a href="${resetUrl}" style="color: #0d9488;">${resetUrl}</a></p>
      <p style="color: #a8a29e; font-size: 12px;">If you didn't request this, ignore this email. Your password won't change.</p>
    </div>
  `,
});

const welcomeEmail = (firstName) => ({
  subject: 'Welcome to LastBite! Your account is verified',
  html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #0d9488;">LastBite</span>
      </div>
      <h2 style="color: #1c1917; font-size: 20px; margin-bottom: 8px;">You're all set, ${firstName}!</h2>
      <p style="color: #57534e; font-size: 15px; line-height: 1.5;">Your email has been verified and your account is now active. Your 30-day free trial has started.</p>
      <p style="color: #57534e; font-size: 15px; line-height: 1.5;">Head to your dashboard to set up your store, add products, and start reducing food waste.</p>
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
      <p style="color: #a8a29e; font-size: 12px; text-align: center;">Thank you for joining LastBite. Together, we're making a difference.</p>
    </div>
  `,
});

module.exports = { verificationOtpEmail, passwordResetEmail, welcomeEmail };
