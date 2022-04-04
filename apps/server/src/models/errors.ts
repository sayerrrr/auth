export class DomainError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends DomainError {
  constructor(message) {
    super(`Validation Error: ${message}`)
  }
}

export class NotFoundError extends DomainError {
  constructor(message) {
    super(`Not Found Error: ${message}`)
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message) {
    super(`Unauthorized Error: ${message}`)
  }
}
