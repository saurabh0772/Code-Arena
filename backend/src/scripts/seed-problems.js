/**
 * Development & Demo Problems Seed Script
 *
 * Seeds exactly 3 deterministic problems:
 * 1. EASY: "Sum of Two Numbers" (2 public, 3 hidden test cases)
 * 2. MEDIUM: "Maximum Element in an Array" (2 public, 4 hidden test cases)
 * 3. HARD: "Longest Increasing Subsequence Length" (2 public, 4 hidden test cases)
 *
 * Idempotent: Can be executed multiple times without duplicating problems or test cases.
 * Preserves user-created data while synchronizing seeded problem definitions and test suites.
 */

const mongoose = require('mongoose');
const User = require('../modules/users/user.model');
const Problem = require('../modules/problems/problem.model');
const TestCase = require('../modules/test-cases/test-case.model');
const { hashPassword } = require('../utils/password');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena';

const SEED_PROBLEMS = [
  {
    title: 'Sum of Two Numbers',
    difficulty: 'EASY',
    tags: ['math', 'basics'],
    description: 'Given two integers A and B, print their sum.',
    inputFormat: 'Two integers A and B separated by a space.',
    outputFormat: 'Print A + B.',
    constraints: '-1000 <= A, B <= 1000',
    examples: [
      {
        input: '2 3',
        output: '5'
      }
    ],
    testCases: [
      {
        input: '2 3',
        expectedOutput: '5',
        visibility: 'PUBLIC',
        order: 1
      },
      {
        input: '-10 20',
        expectedOutput: '10',
        visibility: 'PUBLIC',
        order: 2
      },
      {
        input: '0 0',
        expectedOutput: '0',
        visibility: 'HIDDEN',
        order: 3
      },
      {
        input: '1000 -1000',
        expectedOutput: '0',
        visibility: 'HIDDEN',
        order: 4
      },
      {
        input: '999 1',
        expectedOutput: '1000',
        visibility: 'HIDDEN',
        order: 5
      }
    ]
  },
  {
    title: 'Maximum Element in an Array',
    difficulty: 'MEDIUM',
    tags: ['arrays', 'search', 'basics'],
    description: 'Given an array of N integers, find and print the maximum element.',
    inputFormat: 'First line contains integer N.\nSecond line contains N integers.',
    outputFormat: 'Print the maximum element.',
    constraints: '1 <= N <= 100000\n-10^9 <= A[i] <= 10^9',
    examples: [
      {
        input: '5\n1 7 3 9 2',
        output: '9'
      }
    ],
    testCases: [
      {
        input: '5\n1 7 3 9 2',
        expectedOutput: '9',
        visibility: 'PUBLIC',
        order: 1
      },
      {
        input: '4\n-5 -2 -10 -3',
        expectedOutput: '-2',
        visibility: 'PUBLIC',
        order: 2
      },
      {
        input: '1\n42',
        expectedOutput: '42',
        visibility: 'HIDDEN',
        order: 3
      },
      {
        input: '6\n-100 -50 -1000 -20 -1 -999',
        expectedOutput: '-1',
        visibility: 'HIDDEN',
        order: 4
      },
      {
        input: '8\n1 1 1 1 1 1 1 1',
        expectedOutput: '1',
        visibility: 'HIDDEN',
        order: 5
      },
      {
        input: '10\n9 8 7 6 5 4 3 2 1 100',
        expectedOutput: '100',
        visibility: 'HIDDEN',
        order: 6
      }
    ]
  },
  {
    title: 'Longest Increasing Subsequence Length',
    difficulty: 'HARD',
    tags: ['dynamic-programming', 'arrays', 'binary-search'],
    description: 'Given an array of N integers, find the length of the longest strictly increasing subsequence.',
    inputFormat: 'First line contains integer N.\nSecond line contains N integers.',
    outputFormat: 'Print the length of the longest strictly increasing subsequence.',
    constraints: '1 <= N <= 2000\n-10^9 <= A[i] <= 10^9',
    examples: [
      {
        input: '8\n10 9 2 5 3 7 101 18',
        output: '4'
      }
    ],
    testCases: [
      {
        input: '8\n10 9 2 5 3 7 101 18',
        expectedOutput: '4',
        visibility: 'PUBLIC',
        order: 1
      },
      {
        input: '5\n1 2 3 4 5',
        expectedOutput: '5',
        visibility: 'PUBLIC',
        order: 2
      },
      {
        input: '5\n5 4 3 2 1',
        expectedOutput: '1',
        visibility: 'HIDDEN',
        order: 3
      },
      {
        input: '6\n2 2 2 2 2 2',
        expectedOutput: '1',
        visibility: 'HIDDEN',
        order: 4
      },
      {
        input: '7\n10 1 2 3 4 5 6',
        expectedOutput: '6',
        visibility: 'HIDDEN',
        order: 5
      },
      {
        input: '10\n0 -1 2 -2 3 4 -3 5 6 7',
        expectedOutput: '7',
        visibility: 'HIDDEN',
        order: 6
      }
    ]
  }
];

async function seedProblems() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] Connected to MongoDB:', MONGODB_URI);

    // Ensure system admin exists as problem author
    const email = 'admin@codearena.com';
    let admin = await User.findOne({ email });

    if (!admin) {
      const passwordHash = await hashPassword('AdminPass123!');
      admin = await User.create({
        name: 'System Admin',
        email,
        passwordHash,
        role: 'ADMIN',
        isActive: true
      });
      console.log('[Seed] Created default admin user:', admin.email);
    } else {
      console.log('[Seed] Using existing admin user:', admin.email);
    }

    console.log(`[Seed] Seeding ${SEED_PROBLEMS.length} demo problems...`);

    for (const probDef of SEED_PROBLEMS) {
      const { testCases, ...problemData } = probDef;

      // Upsert problem by title to guarantee idempotency
      let problem = await Problem.findOne({ title: problemData.title });

      if (problem) {
        Object.assign(problem, {
          ...problemData,
          authorId: admin._id,
          isActive: true
        });
        await problem.save();
        console.log(`[Seed] Updated existing problem: "${problem.title}" (${problem.difficulty})`);
      } else {
        problem = await Problem.create({
          ...problemData,
          authorId: admin._id,
          isActive: true
        });
        console.log(`[Seed] Created new problem: "${problem.title}" (${problem.difficulty})`);
      }

      // Synchronize test cases for this specific problem
      await TestCase.deleteMany({ problemId: problem._id });

      const testCaseDocs = testCases.map((tc) => ({
        problemId: problem._id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        visibility: tc.visibility,
        order: tc.order,
        isActive: true
      }));

      await TestCase.insertMany(testCaseDocs);

      const publicCount = testCaseDocs.filter((tc) => tc.visibility === 'PUBLIC').length;
      const hiddenCount = testCaseDocs.filter((tc) => tc.visibility === 'HIDDEN').length;

      console.log(
        `[Seed]   ✓ Test cases synchronized: ${testCaseDocs.length} total (${publicCount} PUBLIC, ${hiddenCount} HIDDEN)`
      );
    }

    console.log('[Seed] All demo problems seeded successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Failed to seed problems:', error);
    process.exit(1);
  }
}

seedProblems();
