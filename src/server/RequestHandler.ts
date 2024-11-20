import bodyParser from 'body-parser';
import { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {Validator, ValidationError} from 'express-json-validator-middleware';
import MailHandler from '@/server/handler/MailHandler';

import { JSONSchema7 } from 'json-schema';

const jsonSchema: Record<string, JSONSchema7> = {
  v3MailSend: {
    type: 'object',
    required: ['personalizations', 'from'],
    if: {
      properties: {
        template_id: { const: null }
      }
    },
    then: {
      required: ['content', 'subject']
    },
    properties: {
      content: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            value: { type: 'string' }
          },
        },
      },
      from: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string' },
          name: { type: ['string', 'null'] },
        },
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
                  email: { type: 'string' }
                },
              },
            },
            custom_args: { type: ['object', 'null'] }
          },
        },
      },
      subject: { type: 'string' },
      template_id: { type: ['string', 'null'] },
      categories: {
        type: ['array', 'null'],
        items: { type: 'string' }
      },
      custom_args: {
        type: ['object', 'null']
      }
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
const RequestHandler = (app: Express, apiAuthenticationKey: any, mailHandler: MailHandler) => {

  const { validate } = new Validator({});

  // Using application/json parser for parsing the request body with a slightly
  // increased limit for the request body size thus allowing larger mails.
  app.use(bodyParser.json({ limit: '5mb' }));

  app.post(
    '/v3/mail/send',
    // @ts-ignore
    validate({ body: jsonSchema.v3MailSend }),
    (req, res) => {

      const reqApiKey = req.headers.authorization;

      if (reqApiKey === `Bearer ${apiAuthenticationKey}`) {
        const messageId = crypto.randomUUID();

        mailHandler.addMail(req.body, messageId);

        res.status(202).header({
          'X-Message-ID': messageId,
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
      to: req.query.to?.toString(),
      subject: req.query.subject?.toString(),
      dateTimeSince: req.query.dateTimeSince?.toString(),
    };

    const paginationCriteria = {
      page: Number(req.query.page?.toString() ?? '0'),
      pageSize: Number(req.query.pageSize?.toString() ?? '10'),
    };

    const mails = mailHandler.getMails(filterCriteria, paginationCriteria);

    res.send(mails);
  });

  app.delete('/api/mails', (req, res) => {

    const filterCriteria = {
      to: req.query.to?.toString() ?? '',
    };

    mailHandler.clear(filterCriteria);

    res.sendStatus(202);
  });

  // Error handler that returns a 400 status code if the request body does not
  // match the given json schema.
  app.use((
    error: Error | ValidationError,
    _: Request,
    response: Response,
    next: NextFunction
  )  => {
    if (error instanceof ValidationError) {
      const responseBody = {
        errors: error.validationErrors.body?.map(validationError => {
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

export default RequestHandler;
