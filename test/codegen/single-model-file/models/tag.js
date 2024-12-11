// 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨  
// DO NOT EDIT: Generated by model-codegen 
// 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 🧨 
const { 
  BaseModel, 
  PrimaryKeyConfig
} = require('dynamo-bao');

const { 
    UlidField,
    StringField,
    CreateDateField
} = require('dynamo-bao').fields;

const { TaggedPost } = require('./tagged-post');

class Tag extends BaseModel {
  static modelPrefix = 't';
  
  static fields = {
    tagId: UlidField({ required: true, autoAssign: true }),
    name: StringField({ required: true }),
    createdAt: CreateDateField(),
  };

  static primaryKey = PrimaryKeyConfig('tagId', 'modelPrefix');



  async cgGetPosts(mapSkCondition=null, limit=null, direction='ASC', startKey=null) {
    return await TaggedPost.getRelatedObjectsViaMap(
      "postsForTag",
      this.getPkValue(),
      "postId",
      mapSkCondition,
      limit,
      direction,
      startKey
    );
  }
  async cgGetRecentPosts(mapSkCondition=null, limit=null, direction='ASC', startKey=null) {
    return await TaggedPost.getRelatedObjectsViaMap(
      "recentPostsForTag",
      this.getPkValue(),
      "postId",
      mapSkCondition,
      limit,
      direction,
      startKey
    );
  }


}

module.exports = { Tag };