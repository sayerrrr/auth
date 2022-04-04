export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(`Validation Error: ${message}`)
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(`Not Found Error: ${message}`)
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string) {
    super(`Unauthorized Error: ${message}`)
  }
}
