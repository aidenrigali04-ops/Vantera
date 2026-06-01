export class EnrollError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EnrollError'
    this.code = code
  }
}

export function isEnrollError(error: unknown): error is EnrollError {
  return error instanceof EnrollError
}
