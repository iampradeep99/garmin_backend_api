const jwt = require("jsonwebtoken");

class JWTService {
  constructor() {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }

    this.JWT_SECRET = process.env.JWT_SECRET;
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
  }

  generateToken(payload) {
    try {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid token payload");
      }

      return jwt.sign(payload, this.JWT_SECRET, {
        expiresIn: this.JWT_EXPIRES_IN,
      });
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  verifyToken(token) {
    try {
      if (!token) {
        throw new Error("Token is required");
      }

      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
}

module.exports = new JWTService();
