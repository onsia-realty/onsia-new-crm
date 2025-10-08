import { z } from 'zod'

export const signUpSchema = z.object({
  username: z.string()
    .min(4, '아이디는 4자 이상이어야 합니다')
    .max(20, '아이디는 20자 이하여야 합니다')
    .regex(/^[a-zA-Z0-9_]+$/, '아이디는 영문, 숫자, 밑줄만 사용 가능합니다'),
  email: z.string().email('유효한 이메일을 입력해주세요'),
  name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  phone: z.string().regex(
    /^(0[0-9]{1,2}|1[0-9]{3})[0-9]{6,8}$/,
    '유효한 전화번호를 입력해주세요 (휴대폰: 010-xxxx-xxxx, 지역번호: 02/031/032 등)'
  ),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다')
    .regex(/[A-Za-z]/, '영문자를 포함해야 합니다')
    .regex(/[0-9]/, '숫자를 포함해야 합니다'),
})

export const signInSchema = z.object({
  username: z.string().min(1, '아이디를 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
})

export const otpSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  code: z.string().length(6, 'OTP 코드는 6자리입니다'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type OtpInput = z.infer<typeof otpSchema>