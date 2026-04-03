// src/utils/ApiError.js
class ApiError extends Error {
    constructor(statusCode = 500, message = "Something went wrong", errors = []) {
        super(message);

        // important so `err.name === "ApiError"` works
        this.name = "ApiError";

        // custom props
        this.statusCode = statusCode;
        this.errors = errors;
        this.success = statusCode < 400;

        // ensure stacktrace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    // optional: control how this object is serialized to JSON
    toJSON() {
        return {
            name: this.name,
            statusCode: this.statusCode,
            success: this.success,
            message: this.message,
            errors: this.errors
        };
    }
}

export { ApiError };
