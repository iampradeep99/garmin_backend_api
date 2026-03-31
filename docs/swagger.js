const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Garmin Backend API',
    version: '1.0.0',
    description: [
      'API documentation for authentication, Garmin OAuth/data APIs, thresholds, and Garmin push/ping webhooks.',
      '',
      'Alerting architecture:',
      '- Garmin push/ping ingestion saves incoming data first.',
      '- Heart rate and blood pressure alerts are evaluated asynchronously through a Mongo-backed alert job worker.',
      '- Threshold read APIs are now read-only and do not trigger email/SMS side effects.'
    ].join('\n')
  },
  servers: [
    { url: 'http://localhost:3002', description: 'Local development' },
    { url: 'https://salestracking.in', description: 'Production' }
  ],
  tags: [
    { name: 'Auth', description: 'User registration and login endpoints' },
    { name: 'Garmin OAuth', description: 'Garmin authorization and connection state endpoints' },
    { name: 'Garmin Data', description: 'Garmin summary, heart rate, blood pressure, and alert test endpoints' },
    { name: 'Threshold', description: 'User threshold endpoints' },
    { name: 'Garmin Push Webhooks', description: 'Garmin direct push payload endpoints' },
    { name: 'Garmin Ping Webhooks', description: 'Garmin ping notification endpoints' },
    { name: 'Users', description: 'Default sample route' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {}
  },
  paths: {}
};

spec.components.schemas.StandardErrorResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '401' },
    statusMessage: { type: 'string', example: 'Unauthorized' },
    data: { type: 'array', items: {} }
  }
};

spec.components.schemas.TextOkResponse = {
  type: 'string',
  example: 'OK'
};

spec.components.schemas.RegisterRequest = {
  type: 'object',
  required: ['fullname', 'mobile_number', 'email', 'dob', 'gender', 'height_cm', 'weight_kg', 'password'],
  properties: {
    fullname: { type: 'string', example: 'Shashank Gupta' },
    mobile_number: { type: 'string', example: '9876543210' },
    email: { type: 'string', format: 'email', example: 'shashank@example.com' },
    dob: { type: 'string', format: 'date', example: '1996-08-15' },
    gender: { type: 'string', enum: ['M', 'F', 'O'], example: 'M' },
    height_cm: { type: 'number', example: 175 },
    weight_kg: { type: 'number', example: 72.5 },
    password: { type: 'string', format: 'password', example: 'secret123' }
  }
};

spec.components.schemas.RegisterResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'User created' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          user_id: { type: 'string', example: '5273914821' },
          fullname: { type: 'string', example: 'Shashank Gupta' },
          email: { type: 'string', example: 'shashank@example.com' }
        }
      }
    }
  }
};

spec.components.schemas.LoginRequest = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email', example: 'shashank@example.com' },
    password: { type: 'string', format: 'password', example: 'secret123' }
  }
};

spec.components.schemas.LoginResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Login successful' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
        }
      }
    }
  }
};

spec.components.schemas.GarminRequestTokenResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Redirect to Garmin' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          authorize_url: { type: 'string', example: 'https://connect.garmin.com/oauth2Confirm?...' }
        }
      }
    }
  }
};

spec.components.schemas.GarminCallbackResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Garmin connected successfully' },
    data: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        expires_in: { type: 'number', example: 3600 },
        expires_at: { type: 'number', example: 1774984252000 },
        scope: { type: 'string', example: 'health:blood_pressure' },
        garminUserId: { type: 'string', example: 'garmin-guid-001' },
        internalUserId: { type: 'string', example: '5273914821' }
      }
    }
  }
};

spec.components.schemas.GarminConnectionStatusResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Garmin connection status' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          isConnected: { type: 'boolean', example: true }
        }
      }
    }
  }
};

spec.components.schemas.GarminDailySummaryItem = {
  type: 'object',
  properties: {
    _id: { type: 'string', example: '67f1234567890abcdef1234' },
    user_id: { type: 'number', example: 5273914821 },
    encoded_user_id: { type: 'string', example: 'encoded-user-001' },
    calendar_date: { type: 'string', format: 'date-time', example: '2026-03-31T00:00:00.000Z' },
    steps: { type: 'number', example: 8234 },
    distance_meters: { type: 'number', example: 5400 },
    active_kcal: { type: 'number', example: 285 },
    bmr_kcal: { type: 'number', example: 1520 },
    avg_heart_rate: { type: 'number', example: 78 },
    resting_heart_rate: { type: 'number', example: 61 },
    stress_avg: { type: 'number', example: 24 }
  }
};

spec.components.schemas.GarminDailySummaryResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Daily summaries retrieved' },
    data: { type: 'array', items: { $ref: '#/components/schemas/GarminDailySummaryItem' } }
  }
};

spec.components.schemas.GarminHeartRateItem = {
  type: 'object',
  properties: {
    _id: { type: 'string', example: '67f1234567890abcdef1234' },
    user_id: { type: 'number', example: 5273914821 },
    encoded_user_id: { type: 'string', example: 'encoded-user-001' },
    timestamp: { type: 'number', example: 1774893000 },
    heart_rate: { type: 'number', example: 84 },
    source: { type: 'string', example: 'epoch' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

spec.components.schemas.GarminHeartRateResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Heart rate data retrieved' },
    data: { type: 'array', items: { $ref: '#/components/schemas/GarminHeartRateItem' } }
  }
};

spec.components.schemas.GarminBloodPressureItem = {
  type: 'object',
  properties: {
    _id: { type: 'string', example: '67f1234567890abcdef1234' },
    user_id: { type: 'number', example: 5273914821 },
    encoded_user_id: { type: 'string', example: 'encoded-user-001' },
    measurement_time: { type: 'number', example: 1774893000 },
    systolic: { type: 'number', example: 120 },
    diastolic: { type: 'number', example: 80 },
    pulse: { type: 'number', example: 72 },
    summary_id: { type: 'string', example: 'manual-bp-001' }
  }
};

spec.components.schemas.GarminBloodPressureResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Blood pressure readings retrieved' },
    data: { type: 'array', items: { $ref: '#/components/schemas/GarminBloodPressureItem' } }
  }
};

spec.components.schemas.CheckEmailRequest = {
  type: 'object',
  required: ['phone', 'email'],
  properties: {
    phone: { type: 'string', example: '9876543210' },
    email: { type: 'string', format: 'email', example: 'careteam@example.com' },
    name: { type: 'string', example: 'Shashank Gupta' },
    bpm: { oneOf: [{ type: 'number' }, { type: 'string' }], example: 98 }
  }
};

spec.components.schemas.CheckEmailSuccessResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    sms: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        error: { nullable: true, oneOf: [{ type: 'string' }, { type: 'object' }] }
      }
    },
    email: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        error: { nullable: true, type: 'string' }
      }
    }
  }
};

spec.components.schemas.ThresholdRequest = {
  type: 'object',
  properties: {
    min_heart_rate: { type: 'integer', example: 55 },
    max_heart_rate: { type: 'integer', example: 120 },
    min_bp: { type: 'integer', example: 70 },
    max_bp: { type: 'integer', example: 140 },
    alert_email: { type: 'string', format: 'email', example: 'alerts@example.com' },
    alert_mobile: { type: 'string', example: '9876543210' }
  }
};

spec.components.schemas.ThresholdDocument = {
  type: 'object',
  properties: {
    _id: { type: 'string', example: '67f1234567890abcdef1234' },
    user_id: { type: 'number', example: 5273914821 },
    min_heart_rate: { type: 'integer', example: 55 },
    max_heart_rate: { type: 'integer', example: 120 },
    min_bp: { type: 'integer', example: 70 },
    max_bp: { type: 'integer', example: 140 },
    alert_email: { type: 'string', example: 'alerts@example.com' },
    alert_mobile: { type: 'string', example: '9876543210' }
  }
};

spec.components.schemas.ThresholdMutationResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Threshold added successfully' },
    data: { type: 'array', items: { $ref: '#/components/schemas/ThresholdDocument' } }
  }
};

spec.components.schemas.ThresholdStatusResponse = {
  type: 'object',
  properties: {
    statusCode: { type: 'string', example: '200' },
    statusMessage: { type: 'string', example: 'Threshold fetched' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          alert_type: { type: 'string', example: 'Heart Rate' },
          alerts: {
            oneOf: [
              { type: 'array', items: { type: 'string', example: 'High Heart Rate 145' } },
              { type: 'string', example: 'No alerts' }
            ]
          }
        }
      }
    }
  }
};

spec.components.schemas.GarminEpochRecord = {
  type: 'object',
  required: ['userId', 'startTimeInSeconds', 'averageHeartRateInBeatsPerMinute'],
  properties: {
    userId: { type: 'string', example: 'encoded-user-001' },
    startTimeInSeconds: { type: 'number', example: 1774893000 },
    averageHeartRateInBeatsPerMinute: { type: 'number', example: 78 }
  }
};

spec.components.schemas.GarminDailyRecord = {
  type: 'object',
  required: ['userId', 'calendarDate', 'summaryId'],
  properties: {
    userId: { type: 'string', example: 'encoded-user-001' },
    calendarDate: { type: 'string', format: 'date', example: '2026-03-31' },
    totalSteps: { type: 'number', example: 8234 },
    totalDistanceInMeters: { type: 'number', example: 5400 },
    activeKilocalories: { type: 'number', example: 285 },
    bmrKilocalories: { type: 'number', example: 1520 },
    averageHeartRateInBeatsPerMinute: { type: 'number', example: 78 },
    restingHeartRateInBeatsPerMinute: { type: 'number', example: 61 },
    maxHeartRateInBeatsPerMinute: { type: 'number', example: 142 },
    averageStressLevel: { type: 'number', example: 24 },
    summaryId: { type: 'string', example: 'summary-001' }
  }
};

spec.components.schemas.GarminBloodPressureRecord = {
  type: 'object',
  required: ['userId', 'summaryId', 'startTimeInSeconds', 'systolicValue', 'diastolicValue'],
  properties: {
    userId: { type: 'string', example: 'encoded-user-001' },
    summaryId: { type: 'string', example: 'bp-001' },
    startTimeInSeconds: { type: 'number', example: 1774893000 },
    systolicValue: { type: 'number', example: 120 },
    diastolicValue: { type: 'number', example: 80 },
    pulseValue: { type: 'number', example: 72 }
  }
};

spec.components.schemas.GarminPushEpochPayload = { type: 'object', properties: { epochs: { type: 'array', items: { $ref: '#/components/schemas/GarminEpochRecord' } } } };
spec.components.schemas.GarminPushDailyPayload = { type: 'object', properties: { dailies: { type: 'array', items: { $ref: '#/components/schemas/GarminDailyRecord' } } } };
spec.components.schemas.GarminPushBloodPressurePayload = { type: 'object', properties: { bloodPressureSummaries: { type: 'array', items: { $ref: '#/components/schemas/GarminBloodPressureRecord' } } } };

spec.components.schemas.GarminPingNotification = {
  type: 'object',
  properties: {
    userId: { type: 'string', example: 'encoded-user-001' },
    userAccessToken: { type: 'string', example: 'garmin-access-token' },
    callbackURL: { type: 'string', format: 'uri', example: 'https://healthapi.garmin.com/wellness-api/rest/epochs?...' }
  }
};

spec.components.schemas.GarminPingNotificationPayload = {
  oneOf: [
    { $ref: '#/components/schemas/GarminPingNotification' },
    {
      type: 'object',
      properties: {
        notifications: { type: 'array', items: { $ref: '#/components/schemas/GarminPingNotification' } }
      }
    }
  ]
};

spec.paths['/api/auth/register'] = {
  post: {
    tags: ['Auth'],
    summary: 'Register a new user',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
    responses: {
      200: { description: 'User created successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterResponse' } } } },
      400: { description: 'Validation or duplicate email error', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/auth/login'] = {
  post: {
    tags: ['Auth'],
    summary: 'Login and receive JWT token',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
    responses: {
      200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
      401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/request-token'] = {
  get: {
    tags: ['Garmin OAuth'],
    summary: 'Create Garmin authorization URL for the authenticated user',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Authorization URL created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminRequestTokenResponse' } } } },
      401: { description: 'Missing or invalid bearer token', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/callback'] = {
  get: {
    tags: ['Garmin OAuth'],
    summary: 'Handle Garmin OAuth callback',
    parameters: [
      { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
      { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
    ],
    responses: {
      200: { description: 'Garmin connected successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminCallbackResponse' } } } },
      400: {
        description: 'Missing or invalid Garmin callback parameters',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                statusCode: { type: 'string', example: '400' },
                statusMessage: { type: 'string', example: 'Missing OAuth parameters' },
                data: { type: 'object', properties: { isConnected: { type: 'boolean', example: false } } }
              }
            }
          }
        }
      }
    }
  }
};

spec.paths['/api/garmin/connection-status'] = {
  post: {
    tags: ['Garmin OAuth'],
    summary: 'Get Garmin connection status for the authenticated user',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Garmin connection status', content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminConnectionStatusResponse' } } } },
      401: { description: 'Unauthorized request', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/summary'] = {
  get: {
    tags: ['Garmin Data'],
    summary: 'Get today daily summary records for the authenticated user',
    description: 'Read-only endpoint. This endpoint returns stored Garmin daily summaries for today and does not trigger alert delivery.',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Daily summaries retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminDailySummaryResponse' } } } },
      401: { description: 'Unauthorized request', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/heart-rate'] = {
  get: {
    tags: ['Garmin Data'],
    summary: 'Get heart rate records for the authenticated user',
    description: 'Read-only endpoint for stored Garmin heart-rate records. Alerts are handled asynchronously when new data is ingested.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'startTime', in: 'query', schema: { type: 'integer' }, description: 'Unix timestamp in seconds' },
      { name: 'endTime', in: 'query', schema: { type: 'integer' }, description: 'Unix timestamp in seconds' },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 1000 } }
    ],
    responses: {
      200: { description: 'Heart rate data retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminHeartRateResponse' } } } },
      400: { description: 'Invalid timestamp query parameter', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/bp'] = {
  get: {
    tags: ['Garmin Data'],
    summary: 'Get blood pressure records for the authenticated user',
    description: 'Read-only endpoint for stored Garmin blood-pressure readings. Alerts are handled asynchronously when new data is ingested.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'startTime', in: 'query', schema: { type: 'integer' }, description: 'Unix timestamp in seconds' },
      { name: 'endTime', in: 'query', schema: { type: 'integer' }, description: 'Unix timestamp in seconds' },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 } }
    ],
    responses: {
      200: { description: 'Blood pressure data retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminBloodPressureResponse' } } } },
      400: { description: 'Invalid timestamp query parameter', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/checkEmail'] = {
  post: {
    tags: ['Garmin Data'],
    summary: 'Send test SMS and email health alert',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckEmailRequest' } } } },
    responses: {
      200: { description: 'Test SMS and email dispatch result', content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckEmailSuccessResponse' } } } },
      400: {
        description: 'Missing phone or email',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'phone and email are required' }
              }
            }
          }
        }
      }
    }
  }
};

spec.paths['/api/threshold'] = {
  post: {
    tags: ['Threshold'],
    summary: 'Create thresholds for the authenticated user',
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ThresholdRequest' } } } },
    responses: {
      200: { description: 'Threshold added successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ThresholdMutationResponse' } } } },
      400: { description: 'Validation error or threshold already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  },
  put: {
    tags: ['Threshold'],
    summary: 'Update thresholds for the authenticated user',
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ThresholdRequest' } } } },
    responses: {
      200: { description: 'Threshold updated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ThresholdMutationResponse' } } } },
      404: { description: 'Threshold not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  },
  get: {
    tags: ['Threshold'],
    summary: 'Evaluate latest BP and heart rate against saved thresholds',
    description: 'Read-only threshold evaluation endpoint. It returns the current alert state based on latest readings, but does not send SMS or email.',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Threshold fetched and latest alert status returned', content: { 'application/json': { schema: { $ref: '#/components/schemas/ThresholdStatusResponse' } } } },
      404: { description: 'No health data or threshold not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardErrorResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/push/heart-rate'] = {
  post: {
    tags: ['Garmin Push Webhooks'],
    summary: 'Receive Garmin heart rate epoch push payload',
    description: 'Stores heart-rate epochs, then enqueues asynchronous threshold evaluation jobs for affected users.',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminPushEpochPayload' } } } },
    responses: {
      200: { description: 'Webhook accepted', content: { 'text/plain': { schema: { $ref: '#/components/schemas/TextOkResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/push/summary'] = {
  post: {
    tags: ['Garmin Push Webhooks'],
    summary: 'Receive Garmin daily summary push payload',
    description: 'Stores Garmin daily summaries. Daily summaries themselves do not enqueue alert jobs in the current implementation.',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminPushDailyPayload' } } } },
    responses: {
      200: { description: 'Webhook accepted', content: { 'text/plain': { schema: { $ref: '#/components/schemas/TextOkResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/push/bp'] = {
  post: {
    tags: ['Garmin Push Webhooks'],
    summary: 'Receive Garmin blood pressure push payload',
    description: 'Stores blood-pressure summaries, then enqueues asynchronous threshold evaluation jobs for affected users.',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminPushBloodPressurePayload' } } } },
    responses: {
      200: { description: 'Webhook accepted', content: { 'text/plain': { schema: { $ref: '#/components/schemas/TextOkResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/ping/heart-rate'] = {
  post: {
    tags: ['Garmin Ping Webhooks'],
    summary: 'Receive Garmin heart rate ping notification and pull callback data asynchronously',
    description: 'Acknowledges the ping immediately, fetches callback data in the background, stores heart-rate records, and enqueues alert jobs.',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminPingNotificationPayload' } } } },
    responses: {
      200: { description: 'Ping accepted immediately for async processing', content: { 'text/plain': { schema: { $ref: '#/components/schemas/TextOkResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/ping/summary'] = {
  post: {
    tags: ['Garmin Ping Webhooks'],
    summary: 'Receive Garmin summary ping notification and pull callback data asynchronously',
    description: 'Acknowledges the ping immediately, fetches callback data in the background, and stores Garmin daily summaries.',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminPingNotificationPayload' } } } },
    responses: {
      200: { description: 'Ping accepted immediately for async processing', content: { 'text/plain': { schema: { $ref: '#/components/schemas/TextOkResponse' } } } }
    }
  }
};

spec.paths['/api/garmin/ping/bp'] = {
  post: {
    tags: ['Garmin Ping Webhooks'],
    summary: 'Receive Garmin blood pressure ping notification and pull callback data asynchronously',
    description: 'Acknowledges the ping immediately, fetches callback data in the background, stores blood-pressure readings, and enqueues alert jobs.',
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GarminPingNotificationPayload' } } } },
    responses: {
      200: { description: 'Ping accepted immediately for async processing', content: { 'text/plain': { schema: { $ref: '#/components/schemas/TextOkResponse' } } } }
    }
  }
};

spec.paths['/users'] = {
  get: {
    tags: ['Users'],
    summary: 'Sample users route',
    responses: {
      200: { description: 'Plain text response', content: { 'text/plain': { schema: { type: 'string', example: 'respond with a resource' } } } }
    }
  }
};

module.exports = spec;
