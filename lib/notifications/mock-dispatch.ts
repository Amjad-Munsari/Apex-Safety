export async function sendMockSMS(to: string, message: string) {
  console.log(`\n\n=== 📱 MOCK SMS DISPATCH ===`)
  console.log(`To: ${to}`)
  console.log(`Message:\n${message}`)
  console.log(`============================\n\n`)
  
  return { success: true, provider: "mock-twilio" }
}

export async function sendMockEmail(to: string, subject: string, body: string) {
  console.log(`\n\n=== 📧 MOCK EMAIL DISPATCH ===`)
  console.log(`To: ${to}`)
  console.log(`Subject: ${subject}`)
  console.log(`Body:\n${body}`)
  console.log(`==============================\n\n`)

  return { success: true, provider: "mock-n8n" }
}
