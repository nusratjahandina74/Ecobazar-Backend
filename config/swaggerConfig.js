const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Eco Bazar E-Commerce API',
      version: '1.0.0',
      description: 'Production Grade Scalable REST API Documentation Engine for Eco Bazar E-Commerce Platform. Supports Dual Token Session Rotation and Multi-Vendor Roles Management.',
      contact: {
        name: 'Nusrat Jahan Dina',
        email: 'nusrat49141@gmail.com'
      }
    },
    servers: [
      { 
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
          name: 'Authorization',
          description: 'Paste your validated system JWT Access Token inside the input box below. Do NOT type "Bearer " manually.'
        }
      },
      schemas: {
        RegistrationInput: {
          type: 'object',
          required: ['name', 'email', 'password', 'terms'],
          properties: {
            name: { type: 'string', minLength: 2, example: 'John Doe', description: "User's full profile legal name." },
            email: { type: 'string', format: 'email', example: 'user@example.com', description: 'Unique core registration identifier.' },
            password: { type: 'string', format: 'password', minLength: 8, example: 'Secr3tP@ss', description: 'Secure user account password minimum 8 characters.' },
            phone: { type: 'string', example: '+1234567890', description: 'Optional sparse system identity phone tracker.' },
            terms: { type: 'boolean', example: true, description: 'User agreement acceptance state status flag.' },
            role: { type: 'string', enum: ['customer', 'vendor', 'admin'], default: 'customer', example: 'customer' }
          }
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', example: 'Secr3tP@ss' }
          }
        },
        EmailInput: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' }
          }
        },
        ResetPasswordInput: {
          type: 'object',
          required: ['newPassword', 'confirmPassword'],
          properties: {
            newPassword: { type: 'string', format: 'password', minLength: 8, example: 'NewSecr3tP@ss' },
            confirmPassword: { type: 'string', format: 'password', minLength: 8, example: 'NewSecr3tP@ss' }
          }
        },

        RegisterResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Registration Successfully Done' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
                name: { type: 'string', example: 'John Doe' },
                email: { type: 'string', example: 'user@example.com' },
                role: { type: 'string', example: 'customer' }
              }
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login Successfully Done' },
            accessToken: { type: 'string', description: 'Short-lived access JWT validation credential key.', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
                name: { type: 'string', example: 'John Doe' },
                email: { type: 'string', example: 'user@example.com' },
                role: { type: 'string', example: 'customer' },
                isEmailVerified: { type: 'boolean', example: false }
              }
            }
          }
        },
        RefreshSuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            accessToken: { type: 'string', description: 'Newly spawned short-lived access credentials signature context.', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.newFreshAccess...' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', description: 'Generic system level tracking validation error fallback message description.', example: 'Internal server error exception logs trace' }
          }
        }
      }
    }
  },

  apis: ['./routes/*.js', './routes/**/*.js'], 
};

const swaggerSpecs = swaggerJsdoc(options);
const swaggerDocs = (app, port) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
  console.log(`Eco Bazar Automated Swagger API Documentation Mounted Active`);
  console.log(`Portal View Gateway Accessible Live At: http://localhost:${process.env.PORT || 5000}/api-docs`);
};

module.exports = swaggerSpecs 
