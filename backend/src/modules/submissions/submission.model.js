const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Problem ID is required']
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      enum: {
        values: ['CPP', 'PYTHON', 'JAVASCRIPT'],
        message: 'Language must be CPP, PYTHON, or JAVASCRIPT'
      }
    },
    sourceCode: {
      type: String,
      required: [true, 'Source code is required'],
      maxlength: [65536, 'Source code cannot exceed 64KB (65536 characters)']
    },
    status: {
      type: String,
      required: true,
      enum: ['SUBMITTED', 'RUNNING', 'COMPLETED'],
      default: 'SUBMITTED'
    },
    verdict: {
      type: String,
      required: true,
      enum: [
        'PENDING',
        'ACCEPTED',
        'WRONG_ANSWER',
        'COMPILATION_ERROR',
        'RUNTIME_ERROR',
        'TIME_LIMIT_EXCEEDED',
        'MEMORY_LIMIT_EXCEEDED'
      ],
      default: 'PENDING'
    },
    runtimeMs: {
      type: Number,
      default: null
    },
    memoryKb: {
      type: Number,
      default: null
    },
    testsPassed: {
      type: Number,
      default: null
    },
    totalTests: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        ret.userId = ret.userId ? ret.userId.toString() : undefined;
        ret.problemId = ret.problemId ? ret.problemId.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound indexes supporting query access patterns
submissionSchema.index({ userId: 1, createdAt: -1 });
submissionSchema.index({ problemId: 1, createdAt: -1 });
submissionSchema.index({ userId: 1, problemId: 1, createdAt: -1 });

// Helper to return clean submission object
submissionSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    problemId: this.problemId.toString(),
    language: this.language,
    sourceCode: this.sourceCode,
    status: this.status,
    verdict: this.verdict,
    runtimeMs: this.runtimeMs,
    memoryKb: this.memoryKb,
    testsPassed: this.testsPassed,
    totalTests: this.totalTests,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;
