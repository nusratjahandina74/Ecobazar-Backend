const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-Commerce API Docs',
      version: '1.0.0',
      description: 'Authentication & User Management API Documentation',
    },
    servers: [
      { 
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Local Development Server'
      }
    ],
    components: {
      // Best Practice: Added security scheme definition to handle JWT bearer protection layouts globally
      securitySchemes: {
        BearerAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'Type "Bearer " followed by your system access token string parameter context'
        }
      },
      schemas: {
        RegistrationInput: {
          type: 'object',
          required: ['email', 'password', 'confirmPassword', 'terms'],
          properties: {
            email: { type: 'string', example: 'user@example.com' },
            password: { type: 'string', example: 'Secr3tP@ss' },
            confirmPassword: { type: 'string', example: 'Secr3tP@ss' },
            terms: { type: 'boolean', example: true }
          }
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', example: 'user@example.com' },
            password: { type: 'string', example: 'Secr3tP@ss' }
          }
        },
        EmailInput: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', example: 'user@example.com' }
          }
        },
        ResetPasswordInput: {
          type: 'object',
          required: ['newPassword', 'confirmPassword'],
          properties: {
            newPassword: { type: 'string', example: 'NewSecr3tP@ss' },
            confirmPassword: { type: 'string', example: 'NewSecr3tP@ss' }
          }
        }
      }
    }
  },
  // Deep search matching scanner rules to automatically look up routes inside file directory structures
  apis: ['./routes/*.js', './routes/**/*.js'], 
};

const swaggerSpecs = swaggerJsdoc(options);
module.exports = { swaggerUi, swaggerSpecs };
