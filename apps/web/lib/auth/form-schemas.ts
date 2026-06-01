import { z } from 'zod'

export const signupFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name'),
  businessName: z
    .string()
    .trim()
    .min(2, 'Please enter your business name'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/\d/, 'Password must include at least one number'),
})

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type SignupFormValues = z.infer<typeof signupFormSchema>
export type LoginFormValues = z.infer<typeof loginFormSchema>

export const EMAIL_EXISTS_MESSAGE =
  'An account with this email already exists. Sign in instead.'

export function isEmailExistsError(message: string | undefined): boolean {
  if (!message) return false
  return message.toLowerCase().includes('already exists')
}

export function isNetworkErrorMessage(message: string | undefined): boolean {
  if (!message) return false
  return /connection|network|fetch|internet/i.test(message)
}
