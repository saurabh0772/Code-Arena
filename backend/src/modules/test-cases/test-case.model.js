const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema(
  {
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Problem ID is required']
    },
    input: {
      type: String,
      required: [true, 'Input is required']
    },
    expectedOutput: {
      type: String,
      required: [true, 'Expected output is required']
    },
    visibility: {
      type: String,
      required: [true, 'Visibility is required'],
      enum: {
        values: ['PUBLIC', 'HIDDEN'],
        message: 'Visibility must be either PUBLIC or HIDDEN'
      }
    },
    order: {
      type: Number,
      required: [true, 'Order is required'],
      min: [0, 'Order must be a non-negative number']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        ret.problemId = ret.problemId ? ret.problemId.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Index supporting active test cases for a problem in execution order
testCaseSchema.index({ problemId: 1, isActive: 1, order: 1 });

// Helper to return clean test case object
testCaseSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    problemId: this.problemId.toString(),
    input: this.input,
    expectedOutput: this.expectedOutput,
    visibility: this.visibility,
    order: this.order,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const TestCase = mongoose.model('TestCase', testCaseSchema);

module.exports = TestCase;
