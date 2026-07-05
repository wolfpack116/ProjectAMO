import { z } from 'zod'

// 서버측 강제(클라 검증은 편의일 뿐). §8 규칙과 일치.
export const registerSchema = z.object({
  username: z.string().regex(/^[A-Za-z0-9_]{3,32}$/),
  password: z.string().min(8).max(128),
  role: z.enum(['pilot', 'forecaster']).optional().default('pilot'),
})

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
})

export default { registerSchema, loginSchema }
