const mongoose = require('mongoose');

const exampleSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: [true, 'Example input is required']
    },
    output: {
      type: String,
      required: [true, 'Example output is required']
    }
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true
    },
    difficulty: {
      type: String,
      required: [true, 'Difficulty is required'],
      enum: {
        values: ['EASY', 'MEDIUM', 'HARD'],
        message: 'Difficulty must be EASY, MEDIUM, or HARD'
      }
    },
    tags: {
      type: [String],
      default: []
    },
    inputFormat: {
      type: String,
      required: [true, 'Input format is required'],
      trim: true
    },
    outputFormat: {
      type: String,
      required: [true, 'Output format is required'],
      trim: true
    },
    constraints: {
      type: String,
      required: [true, 'Constraints are required'],
      trim: true
    },
    examples: {
      type: [exampleSchema],
      required: [true, 'Examples are required'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Problem must have at least one example'
      }
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required']
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
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes matching documented query patterns
problemSchema.index({ isActive: 1, difficulty: 1 });
problemSchema.index({ isActive: 1, createdAt: -1 });
problemSchema.index({ isActive: 1, difficulty: 1, createdAt: -1 });
problemSchema.index({ tags: 1 });
problemSchema.index({ createdAt: -1 });

// Helper to return clean public problem object
problemSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    difficulty: this.difficulty,
    tags: this.tags,
    inputFormat: this.inputFormat,
    outputFormat: this.outputFormat,
    constraints: this.constraints,
    examples: this.examples,
    authorId: this.authorId,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Problem = mongoose.model('Problem', problemSchema);

module.exports = Problem;
