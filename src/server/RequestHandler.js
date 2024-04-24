const bodyParser = require('body-parser');
const crypto = require('crypto');
const {Validator, ValidationError} = require('express-json-validator-middleware');

const jsonSchema = {
  v3MailSend: {
    type: 'object',
    required: ['personalizations', 'from'],
    if: {
      properties: {
        template_id: { const: null }
      }
    },
    then: {
      required: ['content','subject']
    },
    properties: {
      content: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
            },
            value: {
              type: 'string',
            },
          },
        }
      },
      from: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
          },
          name: {
            type: 'string',
            nullable: true,
          },
        }
      },
      personalizations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            to: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                  },
                },
              },
            }
          },
        }
      },
      subject: {
        type: 'string',
      },
      template_id: {
        type: 'string',
        nullable: true,
      },
    }
  }
};

/**
 * Creates a request handler for the given express app.
 * 
 * @param {*} app express app
 * @param {*} apiAuthenticationKey api key for authentication 
 * @param {*} mailHandler  mail handler
 */
const RequestHandler = (app, apiAuthenticationKey, mailHandler) => {

  const { validate } = new Validator();

  // Using application/json parser for parsing the request body with a slightly 
  // increased limit for the request body size thus allowing larger mails.
  app.use(bodyParser.json({ limit: '5mb' }));

  app.post(
    '/v3/mail/send',
    validate({ body: jsonSchema.v3MailSend }), 
    (req, res) => {

      const reqApiKey = req.headers.authorization;
        
      if (reqApiKey === `Bearer ${apiAuthenticationKey}`) {
          
        mailHandler.addMail(req.body);
      
        res.status(202).header({
          'X-Message-ID': crypto.randomUUID(),
        }).send();
      } else {
        res.status(403).send({
          errors: [{
            message: 'Failed authentication',
            field: 'authorization',
            help: 'check used api-key for authentication',
          }],
          id: 'forbidden',
        });
      }
    }
  );
      
  app.get('/api/mails', (req, res) => {
    
    const filterCriteria = {
      to: req.query.to,
      subject: req.query.subject,
      dateTimeSince: req.query.dateTimeSince,
    };
      
    const paginationCriteria = {
      page: req.query.page,
      pageSize: req.query.pageSize,
    };
      
    const mails = mailHandler.getMails(filterCriteria, paginationCriteria);
        
    res.send(mails);
  });
    
  app.delete('/api/mails', (req, res) => {
    
    const filterCriteria = {
      to: req.query.to,
    };
      
    mailHandler.clear(filterCriteria);
      
    res.sendStatus(202);
  });

  // Error handler that returns a 400 status code if the request body does not
  // match the given json schema.
  app.use((error, request, response, next) => {
    if (error instanceof ValidationError) {
      const responseBody = {
        errors: error.validationErrors.body.map(validationError => {
          return {
            field: validationError.params.missingProperty 
              ? validationError.params.missingProperty 
              : validationError.propertyName,
            message: validationError.message,
            path: validationError.schemaPath,
          };
        }),
      };
      response.status(400).send(responseBody);
      next();
    } else {
      next(error);
    }
  });
};

module.exports = RequestHandler;
