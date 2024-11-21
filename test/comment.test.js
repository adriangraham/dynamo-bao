const { 
    initModels, 
    ModelManager,
    User, 
    Post,
    Comment
  } = require('../src');
  const { cleanupTestData, verifyCleanup } = require('./utils/test-utils');
  require('dotenv').config();
  
  let testUser, testPost;
  
  describe('Comment Model', () => {
    beforeAll(async () => {
      initModels({
        region: process.env.AWS_REGION,
        tableName: process.env.TABLE_NAME
      });
    });
  
    beforeEach(async () => {
      const docClient = ModelManager.getInstance().documentClient;
      await cleanupTestData(docClient, process.env.TABLE_NAME);
      await verifyCleanup(docClient, process.env.TABLE_NAME);
  
      // Create a test user and post for each test
      testUser = await User.create({
        name: 'Test User',
        email: `test${Date.now()}@example.com`,
        external_id: `ext${Date.now()}`,
        external_platform: 'platform1',
        role: 'user',
        status: 'active'
      });
  
      testPost = await Post.create({
        userId: testUser.userId,
        title: 'Test Post',
        content: 'Test Content'
      });
    });
  
    afterEach(async () => {
      const docClient = ModelManager.getInstance().documentClient;
      await cleanupTestData(docClient, process.env.TABLE_NAME);
      await verifyCleanup(docClient, process.env.TABLE_NAME);
    });
  
    describe('Basic CRUD Operations', () => {
      test('should create comment successfully', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        expect(comment.postId).toBe(testPost.postId);
        expect(comment.authorId).toBe(testUser.userId);
        expect(comment.text).toBe('Test Comment');
        expect(comment.createdAt).toBeInstanceOf(Date);
        expect(comment.numLikes).toBe(0);
        expect(comment.commentId).toBeDefined();
      });
  
      test('should find comment by primary key', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        const foundComment = await Comment.find(comment.getGlobalId());
        expect(foundComment.text).toBe('Test Comment');
        expect(foundComment.authorId).toBe(testUser.userId);
      });
  
      test('should update comment', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        await Comment.update(comment.getGlobalId(), {
          text: 'Updated Comment',
          numLikes: 1
        });
  
        const updatedComment = await Comment.find(comment.getGlobalId());
        expect(updatedComment.text).toBe('Updated Comment');
        expect(updatedComment.numLikes).toBe(1);
      });
  
      test('should delete comment', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        await Comment.delete(comment.getGlobalId());
      });
    });
  
    describe('Related Data Loading', () => {
      test('should load related author', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        await comment.loadRelatedData(['authorId']);
        const author = comment.getRelated('authorId');
        
        expect(author).toBeDefined();
        expect(author.userId).toBe(testUser.userId);
        expect(author.name).toBe('Test User');
      });
  
      test('should load related post', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        await comment.loadRelatedData(['postId']);
        const post = comment.getRelated('postId');
        
        expect(post).toBeDefined();
        expect(post.postId).toBe(testPost.postId);
        expect(post.title).toBe('Test Post');
      });
  
      test('should load all related data', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        await comment.loadRelatedData();
        const author = comment.getRelated('authorId');
        const post = comment.getRelated('postId');
        
        expect(author).toBeDefined();
        expect(author.userId).toBe(testUser.userId);
        expect(post).toBeDefined();
        expect(post.postId).toBe(testPost.postId);
      });
    });
  
    describe('Instance Methods', () => {
      test('should track changes correctly', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        expect(comment.hasChanges()).toBeFalsy();
        
        comment.text = 'Updated Text';
        comment.numLikes = 1;
        
        expect(comment.hasChanges()).toBeTruthy();
        expect(comment.getChanges()).toEqual({
          text: 'Updated Text',
          numLikes: 1
        });
      });
  
      test('should save changes', async () => {
        const comment = await Comment.create({
          postId: testPost.postId,
          authorId: testUser.userId,
          text: 'Test Comment'
        });
  
        comment.text = 'Updated Text';
        await comment.save();
  
        const updatedComment = await Comment.find(comment.getGlobalId());
        expect(updatedComment.text).toBe('Updated Text');
      });
    });
  
    describe('Comment Queries', () => {
      test('should query comments for a post', async () => {
        // Create multiple comments for the test post
        const comments = await Promise.all([
          Comment.create({
            postId: testPost.postId,
            authorId: testUser.userId,
            text: 'First Comment'
          }),
          Comment.create({
            postId: testPost.postId,
            authorId: testUser.userId,
            text: 'Second Comment'
          })
        ]);

        // Query comments using the post instance
        const result = await testPost.queryComments();
        
        expect(result.items).toHaveLength(2);
        expect(result.items.map(c => c.text).sort()).toEqual(
          ['First Comment', 'Second Comment'].sort()
        );
      });

      test('should handle pagination when querying comments', async () => {
        // Create multiple comments
        await Promise.all([
          Comment.create({
            postId: testPost.postId,
            authorId: testUser.userId,
            text: 'First Comment'
          }),
          Comment.create({
            postId: testPost.postId,
            authorId: testUser.userId,
            text: 'Second Comment'
          })
        ]);

        // Get first page
        const firstPage = await testPost.queryComments(1);
        expect(firstPage.items).toHaveLength(1);
        expect(firstPage.lastEvaluatedKey).toBeDefined();

        // Get second page
        const secondPage = await testPost.queryComments(1, firstPage.lastEvaluatedKey);
        expect(secondPage.items).toHaveLength(1);
        expect(secondPage.lastEvaluatedKey).toBeUndefined();
        
        // Verify different comments were returned
        expect(firstPage.items[0].text).not.toBe(secondPage.items[0].text);
      });

      test('should return empty result for post with no comments', async () => {
        // Create a new post with no comments
        const emptyPost = await Post.create({
          userId: testUser.userId,
          title: 'Empty Post',
          content: 'No Comments'
        });

        const result = await emptyPost.queryComments();
        
        expect(result.items).toHaveLength(0);
        expect(result.lastEvaluatedKey).toBeUndefined();
      });
    });
  });