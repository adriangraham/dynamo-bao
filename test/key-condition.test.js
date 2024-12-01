const { initModels } = require('../src');
const { ModelManager } = require('../src/model-manager');
const { BaseModel, PrimaryKeyConfig, IndexConfig, GSI_INDEX_ID1 } = require('../src/model');
const { 
  StringField, 
  IntegerField, 
  BooleanField, 
  DateTimeField, 
  ULIDField 
} = require('../src/fields');
const { cleanupTestData, verifyCleanup } = require('./utils/test-utils');
const { ulid } = require('ulid');
require('dotenv').config();
const { defaultLogger: logger } = require('../src/utils/logger');

let testId;

class TestUser extends BaseModel {
  static modelPrefix = 'tu';
  
  static fields = {
    userId: ULIDField({ required: true, autoAssign: true }),
    name: StringField({ required: true }),
    age: IntegerField(),
    status: StringField(),
    category: StringField(),
    isVerified: BooleanField({ defaultValue: false }),
    score: IntegerField({ defaultValue: 0 })
  };

  static primaryKey = PrimaryKeyConfig('userId');

  static indexes = {
    byStatus: IndexConfig('status', 'category', GSI_INDEX_ID1)
  };
}

describe('Key Condition Tests', () => {
  let users = [];

  beforeEach(async () => {
    testId = ulid();
  
    initModels({
      region: process.env.AWS_REGION,
      tableName: process.env.TABLE_NAME,
      test_id: testId
    });

    const manager = ModelManager.getInstance(testId);
    manager.registerModel(TestUser);

    TestUser.documentClient = manager.documentClient;
    TestUser.table = manager.tableName;
    TestUser.validateConfiguration();
    TestUser.registerRelatedIndexes();

    if (testId) {
      await cleanupTestData(testId);
      await verifyCleanup(testId);
    }

    // Create test users with more predictable data
    users = await Promise.all([
      TestUser.create({
        name: 'John Doe',
        status: 'active',
        category: 'premium', 
        score: 100
      }),
      TestUser.create({
        name: 'Jane Smith',
        status: 'active',
        category: 'basic',
        score: 150
      }),
      TestUser.create({
        name: 'Bob Wilson',
        status: 'active',
        category: 'standard',
        score: 75
      })
    ]);
  });

  afterEach(async () => {
    if (testId) {
      await cleanupTestData(testId);
      await verifyCleanup(testId);
    }
  });

  test('should query with simple equality key condition', async () => {
    const result = await TestUser.queryByIndex('byStatus', 'active', {
      category: 'premium'
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('John Doe');
  });

  test('should query with $beginsWith key condition', async () => {
    const result = await TestUser.queryByIndex('byStatus', 'active', {
      category: { $beginsWith: 'pre' }
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('John Doe');
  });

  test('should query with $between key condition', async () => {
    const result = await TestUser.queryByIndex('byStatus', 'active', {
      category: { $between: ['basic', 'premium'] }
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map(u => u.name).sort()).toEqual(['Jane Smith', 'John Doe']);
  });

  test('should query with comparison operators', async () => {
    logger.log('Test data:', users.map(u => ({
      name: u.name,
      status: u.status,
      category: u.category
    })));

    logger.log('Building query with condition:', {
      category: { $gt: 'basic' }
    });

    const result = await TestUser.queryByIndex('byStatus', 'active', {
      category: { $gt: 'basic' }
    });

    logger.log('Query result:', {
      items: result.items.map(i => ({
        name: i.name,
        category: i.category
      })),
      params: result._response
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map(u => u.name)).toEqual(['John Doe', 'Bob Wilson']);
  });

  test('should reject invalid sort key field', async () => {
    await expect(
      TestUser.queryByIndex('byStatus', 'active', {
        invalidField: 'value'
      })
    ).rejects.toThrow('Field "invalidField" is not the sort key for index "byStatus"');
  });

  test('should reject invalid operator', async () => {
    await expect(
      TestUser.queryByIndex('byStatus', 'active', {
        category: { $invalid: 'value' }
      })
    ).rejects.toThrow(/Unsupported sort key operator/);
  });

  test('should combine key condition with filter expression', async () => {
    const result = await TestUser.queryByIndex('byStatus', 'active', 
      { category: 'premium' },
      { filter: { score: { $gt: 50 } } }
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('John Doe');
  });

  test('should handle $between with invalid array length', async () => {
    await expect(
      TestUser.queryByIndex('byStatus', 'active', {
        category: { $between: ['basic'] } // Missing second value
      })
    ).rejects.toThrow('$between requires an array with exactly 2 elements');
  });
}); 