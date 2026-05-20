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
        // ==== AUTH & USER SCHEMAS ====
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
            message: { type: 'string', description: 'Generic validation error description.', example: 'Internal server error exception logs trace' }
          }
        },

        // ---- NEW PRODUCT SCHEMA COMPONENTS INTEGRATED HERE ----
        ProductImage: {
          type: 'object',
          properties: {
            url: { type: 'string', example: "https://cloudinary.com" },
            isMain: { type: 'boolean', default: false, example: true }
          }
        },
        ProductInput: {
          type: 'object',
          required: ['title', 'price', 'category'],
          properties: {
            title: { type: 'string', description: 'Unique catalog item header title.', example: 'Organic Raw Green Tea' },
            description: { type: 'string', example: 'Handpicked organic green tea leaves rich in antioxidants.' },
            price: { type: 'number', example: 15.50 },
            discountPrice: { type: 'number', example: 12.00 },
            stock: { type: 'number', default: 0, example: 50 },
            shortDescription: { type: 'string', example: '100% Pure Natural Tea Leaves.' },
            category: { type: 'string', example: 'Beverages' },
            subCategory: { type: 'string', example: 'Teas' },
            tag: { type: 'array', items: { type: 'string' }, example: ['organic', 'herbal', 'green-tea'] },
            additionalInfo: { type: 'string', example: 'Net Weight: 250g, Shelf Life: 12 Months' },
            status: { type: 'string', enum: ['pending', 'active', 'inactive'], default: 'pending', example: 'active' },
            images: { type: 'array', items: { $ref: '#/components/schemas/ProductImage' } }
          }
        },
        ProductResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Product operation successful' },
            data: {
              type: 'object',
              properties: {
                _id: { type: 'string', example: '651c6c5a3d7b42001f3e721a' },
                title: { type: 'string', example: 'Organic Raw Green Tea' },
                sku: { type: 'string', example: '1716315840000-2026' },
                price: { type: 'number', example: 15.50 },
                category: { type: 'string', example: 'Beverages' },
                status: { type: 'string', example: 'pending' },
                createdAt: { type: 'string', format: 'date-time', example: '2026-05-20T17:15:00.000Z' },
                updatedAt: { type: 'string', format: 'date-time', example: '2026-05-20T17:15:00.000Z' }
              }
            }
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
  console.log(`http://localhost:${port}/api-docs`);
};

module.exports = swaggerDocs;
