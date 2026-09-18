/**
 * CodeArena — Comprehensive Development Seed Script
 *
 * Seeds:
 * - 2 Users (1 USER, 1 ADMIN) with Argon2 hashed passwords
 * - 12 Problems (4 EASY, 4 MEDIUM, 4 HARD)
 * - 72 Test Cases (2 PUBLIC + 4 HIDDEN per problem)
 *
 * Rules:
 * - Idempotent: Can be run repeatedly without duplicating records
 * - Never deletes entire database or user-created records
 * - Safe for development/local testing only (guarded against production)
 */

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const User = require('../modules/users/user.model');
const Problem = require('../modules/problems/problem.model');
const TestCase = require('../modules/test-cases/test-case.model');
const { hashPassword, verifyPassword } = require('../utils/password');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codearena';

// Production safety guard
if (process.env.NODE_ENV === 'production') {
  console.error('[Seed Error] Development seed script cannot be executed in production environment.');
  process.exit(1);
}

const SEED_USERS = [
  {
    name: 'CodeArena User',
    email: 'user@codearena.dev',
    password: 'User@12345',
    role: 'USER',
    isActive: true
  },
  {
    name: 'CodeArena Admin',
    email: 'admin@codearena.dev',
    password: 'Admin@12345',
    role: 'ADMIN',
    isActive: true
  }
];

const SEED_PROBLEMS = [
  // =========================================================================
  // 1. EASY PROBLEMS (4 Problems, 24 Test Cases)
  // =========================================================================
  {
    title: 'Sum of Two Numbers',
    difficulty: 'EASY',
    tags: ['arrays', 'math'],
    description: 'Given two integers A and B, calculate and print their sum.',
    inputFormat: 'A single line containing two space-separated integers A and B.',
    outputFormat: 'Print the sum of A and B on a single line.',
    constraints: '-10^9 <= A, B <= 10^9',
    examples: [
      { input: '2 3\n', output: '5\n' },
      { input: '-10 20\n', output: '10\n' }
    ],
    testCases: [
      { input: '2 3\n', expectedOutput: '5\n', visibility: 'PUBLIC', order: 1 },
      { input: '-10 20\n', expectedOutput: '10\n', visibility: 'PUBLIC', order: 2 },
      { input: '0 0\n', expectedOutput: '0\n', visibility: 'HIDDEN', order: 3 },
      { input: '1000000000 -1000000000\n', expectedOutput: '0\n', visibility: 'HIDDEN', order: 4 },
      { input: '500000000 500000000\n', expectedOutput: '1000000000\n', visibility: 'HIDDEN', order: 5 },
      { input: '-500000000 -500000000\n', expectedOutput: '-1000000000\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Maximum Element in an Array',
    difficulty: 'EASY',
    tags: ['arrays', 'implementation'],
    description: 'Given an integer N followed by an array of N integers, find and print the maximum element in the array.',
    inputFormat: 'The first line contains an integer N, the number of elements in the array.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print the maximum element on a single line.',
    constraints: '1 <= N <= 10^5\n-10^9 <= A[i] <= 10^9',
    examples: [
      { input: '5\n1 7 3 9 2\n', output: '9\n' },
      { input: '4\n-5 -2 -10 -3\n', output: '-2\n' }
    ],
    testCases: [
      { input: '5\n1 7 3 9 2\n', expectedOutput: '9\n', visibility: 'PUBLIC', order: 1 },
      { input: '4\n-5 -2 -10 -3\n', expectedOutput: '-2\n', visibility: 'PUBLIC', order: 2 },
      { input: '1\n42\n', expectedOutput: '42\n', visibility: 'HIDDEN', order: 3 },
      { input: '6\n-100 -50 -1000 -20 -1 -999\n', expectedOutput: '-1\n', visibility: 'HIDDEN', order: 4 },
      { input: '5\n10 10 10 10 10\n', expectedOutput: '10\n', visibility: 'HIDDEN', order: 5 },
      { input: '7\n100 200 50 800 300 800 150\n', expectedOutput: '800\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Count Even Numbers',
    difficulty: 'EASY',
    tags: ['arrays', 'math'],
    description: 'Given an integer N followed by an array of N integers, count and print how many elements in the array are even numbers.',
    inputFormat: 'The first line contains an integer N.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print the number of even integers in the array on a single line.',
    constraints: '1 <= N <= 10^5\n-10^9 <= A[i] <= 10^9',
    examples: [
      { input: '5\n1 2 3 4 5\n', output: '2\n' },
      { input: '4\n2 4 6 8\n', output: '4\n' }
    ],
    testCases: [
      { input: '5\n1 2 3 4 5\n', expectedOutput: '2\n', visibility: 'PUBLIC', order: 1 },
      { input: '4\n2 4 6 8\n', expectedOutput: '4\n', visibility: 'PUBLIC', order: 2 },
      { input: '4\n1 3 5 7\n', expectedOutput: '0\n', visibility: 'HIDDEN', order: 3 },
      { input: '1\n0\n', expectedOutput: '1\n', visibility: 'HIDDEN', order: 4 },
      { input: '6\n-2 -3 -4 0 5 8\n', expectedOutput: '4\n', visibility: 'HIDDEN', order: 5 },
      { input: '7\n-11 -13 -17 22 24 26 28\n', expectedOutput: '4\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Reverse a String',
    difficulty: 'EASY',
    tags: ['strings', 'implementation'],
    description: 'Given a string S, print the string in reverse order.',
    inputFormat: 'A single line containing the string S.',
    outputFormat: 'Print the reversed string on a single line.',
    constraints: '1 <= length of S <= 10^5\nS consists of printable ASCII characters.',
    examples: [
      { input: 'codearena\n', output: 'aneraedoc\n' },
      { input: 'hello\n', output: 'olleh\n' }
    ],
    testCases: [
      { input: 'codearena\n', expectedOutput: 'aneraedoc\n', visibility: 'PUBLIC', order: 1 },
      { input: 'hello\n', expectedOutput: 'olleh\n', visibility: 'PUBLIC', order: 2 },
      { input: 'a\n', expectedOutput: 'a\n', visibility: 'HIDDEN', order: 3 },
      { input: 'racecar\n', expectedOutput: 'racecar\n', visibility: 'HIDDEN', order: 4 },
      { input: '1234567890\n', expectedOutput: '0987654321\n', visibility: 'HIDDEN', order: 5 },
      { input: 'Algorithm\n', expectedOutput: 'mhtiroglA\n', visibility: 'HIDDEN', order: 6 }
    ]
  },

  // =========================================================================
  // 2. MEDIUM PROBLEMS (4 Problems, 24 Test Cases)
  // =========================================================================
  {
    title: 'Second Largest Element',
    difficulty: 'MEDIUM',
    tags: ['arrays', 'sorting'],
    description: 'Given an array of N integers, find the second largest distinct element in the array. If fewer than two distinct elements exist, print -1.',
    inputFormat: 'The first line contains an integer N.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print the second largest distinct element, or -1 if no such element exists.',
    constraints: '1 <= N <= 10^5\n-10^9 <= A[i] <= 10^9',
    examples: [
      { input: '5\n12 35 1 10 34\n', output: '34\n' },
      { input: '3\n10 10 10\n', output: '-1\n' }
    ],
    testCases: [
      { input: '5\n12 35 1 10 34\n', expectedOutput: '34\n', visibility: 'PUBLIC', order: 1 },
      { input: '3\n10 10 10\n', expectedOutput: '-1\n', visibility: 'PUBLIC', order: 2 },
      { input: '1\n50\n', expectedOutput: '-1\n', visibility: 'HIDDEN', order: 3 },
      { input: '4\n-10 -20 -30 -40\n', expectedOutput: '-20\n', visibility: 'HIDDEN', order: 4 },
      { input: '6\n5 5 4 4 3 3\n', expectedOutput: '4\n', visibility: 'HIDDEN', order: 5 },
      { input: '7\n100 200 300 400 500 500 499\n', expectedOutput: '499\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Two Sum',
    difficulty: 'MEDIUM',
    tags: ['arrays', 'hash-map'],
    description: 'Given an array of N integers and a target value T, determine whether there exist two distinct indices i and j (i != j) such that A[i] + A[j] == T. Print YES if such a pair exists, otherwise print NO.',
    inputFormat: 'The first line contains two space-separated integers N and T.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print YES if two distinct elements sum to T, otherwise print NO.',
    constraints: '2 <= N <= 10^5\n-10^9 <= A[i], T <= 10^9',
    examples: [
      { input: '4 9\n2 7 11 15\n', output: 'YES\n' },
      { input: '3 6\n3 1 4\n', output: 'NO\n' }
    ],
    testCases: [
      { input: '4 9\n2 7 11 15\n', expectedOutput: 'YES\n', visibility: 'PUBLIC', order: 1 },
      { input: '3 6\n3 1 4\n', expectedOutput: 'NO\n', visibility: 'PUBLIC', order: 2 },
      { input: '2 10\n5 5\n', expectedOutput: 'YES\n', visibility: 'HIDDEN', order: 3 },
      { input: '4 0\n-5 2 5 1\n', expectedOutput: 'YES\n', visibility: 'HIDDEN', order: 4 },
      { input: '5 100\n10 20 30 40 50\n', expectedOutput: 'NO\n', visibility: 'HIDDEN', order: 5 },
      { input: '6 15\n1 2 4 7 11 15\n', expectedOutput: 'YES\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Longest Subarray With Given Sum',
    difficulty: 'MEDIUM',
    tags: ['arrays', 'prefix-sum', 'sliding-window'],
    description: 'Given an array of N integers and a target sum K, find the length of the longest contiguous subarray whose sum equals K. If no such subarray exists, print 0.',
    inputFormat: 'The first line contains two integers N and K.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print the length of the longest subarray with sum equal to K.',
    constraints: '1 <= N <= 10^5\n-10^9 <= A[i], K <= 10^9',
    examples: [
      { input: '6 15\n10 5 2 7 1 9\n', output: '4\n' },
      { input: '3 5\n1 2 3\n', output: '2\n' }
    ],
    testCases: [
      { input: '6 15\n10 5 2 7 1 9\n', expectedOutput: '4\n', visibility: 'PUBLIC', order: 1 },
      { input: '3 5\n1 2 3\n', expectedOutput: '2\n', visibility: 'PUBLIC', order: 2 },
      { input: '4 10\n1 2 3 4\n', expectedOutput: '4\n', visibility: 'HIDDEN', order: 3 },
      { input: '5 50\n1 2 3 4 5\n', expectedOutput: '0\n', visibility: 'HIDDEN', order: 4 },
      { input: '5 0\n1 -1 2 -2 3\n', expectedOutput: '4\n', visibility: 'HIDDEN', order: 5 },
      { input: '7 3\n-1 2 3 -2 1 1 -2\n', expectedOutput: '6\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Valid Parentheses',
    difficulty: 'MEDIUM',
    tags: ['strings', 'stack'],
    description: 'Given a string S consisting of the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. A string is valid if open brackets are closed by the same type of brackets in the correct order, and every close bracket has a corresponding open bracket of the same type. Print YES if valid, otherwise print NO.',
    inputFormat: 'A single line containing the bracket string S.',
    outputFormat: 'Print YES if the brackets are balanced, otherwise print NO.',
    constraints: '1 <= length of S <= 10^5\nS consists only of "()[]{}".',
    examples: [
      { input: '()[]{}\n', output: 'YES\n' },
      { input: '(]\n', output: 'NO\n' }
    ],
    testCases: [
      { input: '()[]{}\n', expectedOutput: 'YES\n', visibility: 'PUBLIC', order: 1 },
      { input: '(]\n', expectedOutput: 'NO\n', visibility: 'PUBLIC', order: 2 },
      { input: '([{}])\n', expectedOutput: 'YES\n', visibility: 'HIDDEN', order: 3 },
      { input: '([)]\n', expectedOutput: 'NO\n', visibility: 'HIDDEN', order: 4 },
      { input: '(((((((()\n', expectedOutput: 'NO\n', visibility: 'HIDDEN', order: 5 },
      { input: '{[]()}\n', expectedOutput: 'YES\n', visibility: 'HIDDEN', order: 6 }
    ]
  },

  // =========================================================================
  // 3. HARD PROBLEMS (4 Problems, 24 Test Cases)
  // =========================================================================
  {
    title: 'Longest Increasing Subsequence Length',
    difficulty: 'HARD',
    tags: ['dynamic-programming', 'binary-search'],
    description: 'Given an array of N integers, find the length of the longest strictly increasing subsequence.',
    inputFormat: 'The first line contains an integer N.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print the length of the longest strictly increasing subsequence.',
    constraints: '1 <= N <= 2000\n-10^9 <= A[i] <= 10^9',
    examples: [
      { input: '8\n10 9 2 5 3 7 101 18\n', output: '4\n' },
      { input: '6\n0 1 0 3 2 3\n', output: '4\n' }
    ],
    testCases: [
      { input: '8\n10 9 2 5 3 7 101 18\n', expectedOutput: '4\n', visibility: 'PUBLIC', order: 1 },
      { input: '6\n0 1 0 3 2 3\n', expectedOutput: '4\n', visibility: 'PUBLIC', order: 2 },
      { input: '5\n5 4 3 2 1\n', expectedOutput: '1\n', visibility: 'HIDDEN', order: 3 },
      { input: '6\n7 7 7 7 7 7\n', expectedOutput: '1\n', visibility: 'HIDDEN', order: 4 },
      { input: '7\n1 2 3 4 5 6 7\n', expectedOutput: '7\n', visibility: 'HIDDEN', order: 5 },
      { input: '10\n0 -1 2 -2 3 4 -3 5 6 7\n', expectedOutput: '7\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Minimum Path Sum',
    difficulty: 'HARD',
    tags: ['dynamic-programming', 'matrix'],
    description: 'Given an M x N grid filled with non-negative integers, find a path from top-left cell (0, 0) to bottom-right cell (M-1, N-1) which minimizes the sum of all numbers along its path. You can only move either right or down at any point in time.',
    inputFormat: 'The first line contains two integers M and N, representing the rows and columns of the grid.\nThe next M lines each contain N space-separated non-negative integers.',
    outputFormat: 'Print the minimum path sum from (0, 0) to (M-1, N-1).',
    constraints: '1 <= M, N <= 200\n0 <= Grid[i][j] <= 1000',
    examples: [
      { input: '3 3\n1 3 1\n1 5 1\n4 2 1\n', output: '7\n' },
      { input: '2 3\n1 2 3\n4 5 6\n', output: '12\n' }
    ],
    testCases: [
      { input: '3 3\n1 3 1\n1 5 1\n4 2 1\n', expectedOutput: '7\n', visibility: 'PUBLIC', order: 1 },
      { input: '2 3\n1 2 3\n4 5 6\n', expectedOutput: '12\n', visibility: 'PUBLIC', order: 2 },
      { input: '1 1\n5\n', expectedOutput: '5\n', visibility: 'HIDDEN', order: 3 },
      { input: '1 4\n1 2 3 4\n', expectedOutput: '10\n', visibility: 'HIDDEN', order: 4 },
      { input: '4 1\n2\n3\n5\n1\n', expectedOutput: '11\n', visibility: 'HIDDEN', order: 5 },
      { input: '3 4\n1 2 5 1\n1 8 1 2\n4 2 1 1\n', expectedOutput: '10\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Number of Islands',
    difficulty: 'HARD',
    tags: ['graphs', 'bfs', 'dfs', 'matrix'],
    description: 'Given an M x N 2D binary grid which represents a map of "1"s (land) and "0"s (water), return the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically (4-directional connectivity). You may assume all four edges of the grid are completely surrounded by water.',
    inputFormat: 'The first line contains two integers M and N, the number of rows and columns.\nThe next M lines each contain N space-separated integers (either 0 or 1).',
    outputFormat: 'Print the total number of islands on a single line.',
    constraints: '1 <= M, N <= 200\nGrid[i][j] is either 0 or 1.',
    examples: [
      { input: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0\n', output: '1\n' },
      { input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1\n', output: '3\n' }
    ],
    testCases: [
      { input: '4 5\n1 1 1 1 0\n1 1 0 1 0\n1 1 0 0 0\n0 0 0 0 0\n', expectedOutput: '1\n', visibility: 'PUBLIC', order: 1 },
      { input: '4 5\n1 1 0 0 0\n1 1 0 0 0\n0 0 1 0 0\n0 0 0 1 1\n', expectedOutput: '3\n', visibility: 'PUBLIC', order: 2 },
      { input: '3 3\n0 0 0\n0 0 0\n0 0 0\n', expectedOutput: '0\n', visibility: 'HIDDEN', order: 3 },
      { input: '3 3\n1 1 1\n1 1 1\n1 1 1\n', expectedOutput: '1\n', visibility: 'HIDDEN', order: 4 },
      { input: '3 3\n1 0 1\n0 1 0\n1 0 1\n', expectedOutput: '5\n', visibility: 'HIDDEN', order: 5 },
      { input: '5 5\n1 0 0 0 1\n0 1 0 1 0\n0 0 1 0 0\n0 1 0 1 0\n1 0 0 0 1\n', expectedOutput: '9\n', visibility: 'HIDDEN', order: 6 }
    ]
  },
  {
    title: 'Shortest Path in an Unweighted Graph',
    difficulty: 'HARD',
    tags: ['graphs', 'bfs', 'shortest-path'],
    description: 'Given an unweighted, undirected graph with V vertices (labeled 1 to V) and E edges, along with two vertices S (source) and D (destination), find the shortest number of edges in a path between S and D. If no path exists between S and D, print -1.',
    inputFormat: 'The first line contains two integers V and E.\nThe next E lines each contain two integers u and v, representing an undirected edge between vertex u and vertex v.\nThe last line contains two integers S and D, representing the source and destination vertices.',
    outputFormat: 'Print the minimum number of edges between S and D, or -1 if no path exists.',
    constraints: '1 <= V <= 10^5\n0 <= E <= 2 * 10^5\n1 <= u, v, S, D <= V',
    examples: [
      { input: '4 4\n1 2\n2 3\n3 4\n1 3\n1 4\n', output: '2\n' },
      { input: '3 1\n1 2\n1 3\n', output: '-1\n' }
    ],
    testCases: [
      { input: '4 4\n1 2\n2 3\n3 4\n1 3\n1 4\n', expectedOutput: '2\n', visibility: 'PUBLIC', order: 1 },
      { input: '3 1\n1 2\n1 3\n', expectedOutput: '-1\n', visibility: 'PUBLIC', order: 2 },
      { input: '3 2\n1 2\n2 3\n1 1\n', expectedOutput: '0\n', visibility: 'HIDDEN', order: 3 },
      { input: '5 4\n1 2\n2 3\n3 4\n4 5\n1 5\n', expectedOutput: '4\n', visibility: 'HIDDEN', order: 4 },
      { input: '5 5\n1 2\n2 3\n3 4\n4 5\n1 5\n1 5\n', expectedOutput: '1\n', visibility: 'HIDDEN', order: 5 },
      { input: '6 4\n1 2\n2 3\n4 5\n5 6\n1 6\n', expectedOutput: '-1\n', visibility: 'HIDDEN', order: 6 }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);

    // 1. Seed Users
    let userCount = 0;
    let adminUser = null;

    for (const u of SEED_USERS) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        existing.name = u.name;
        existing.role = u.role;
        existing.isActive = u.isActive;

        const isMatch = await verifyPassword(existing.passwordHash, u.password);
        if (!isMatch) {
          existing.passwordHash = await hashPassword(u.password);
        }
        await existing.save();
        if (u.role === 'ADMIN') adminUser = existing;
      } else {
        const passwordHash = await hashPassword(u.password);
        const created = await User.create({
          name: u.name,
          email: u.email,
          passwordHash,
          role: u.role,
          isActive: u.isActive
        });
        if (u.role === 'ADMIN') adminUser = created;
      }
      userCount++;
    }

    if (!adminUser) {
      throw new Error('Admin user could not be initialized as problem author.');
    }

    // 2. Seed Problems & Test Cases
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;
    let publicTcCount = 0;
    let hiddenTcCount = 0;

    for (const pDef of SEED_PROBLEMS) {
      const { testCases, ...problemData } = pDef;

      let problem = await Problem.findOne({ title: problemData.title });
      if (problem) {
        problem.description = problemData.description;
        problem.difficulty = problemData.difficulty;
        problem.tags = problemData.tags;
        problem.inputFormat = problemData.inputFormat;
        problem.outputFormat = problemData.outputFormat;
        problem.constraints = problemData.constraints;
        problem.examples = problemData.examples;
        problem.authorId = adminUser._id;
        problem.isActive = true;
        await problem.save();
      } else {
        problem = await Problem.create({
          ...problemData,
          authorId: adminUser._id,
          isActive: true
        });
      }

      if (problem.difficulty === 'EASY') easyCount++;
      else if (problem.difficulty === 'MEDIUM') mediumCount++;
      else if (problem.difficulty === 'HARD') hardCount++;

      // Upsert the 6 canonical test cases (2 PUBLIC, 4 HIDDEN)
      const seededTcIds = [];
      for (const tc of testCases) {
        const doc = await TestCase.findOneAndUpdate(
          { problemId: problem._id, order: tc.order },
          {
            problemId: problem._id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            visibility: tc.visibility,
            order: tc.order,
            isActive: true
          },
          { upsert: true, returnDocument: 'after' }
        );
        seededTcIds.push(doc._id);

        if (tc.visibility === 'PUBLIC') publicTcCount++;
        else if (tc.visibility === 'HIDDEN') hiddenTcCount++;
      }

      // Reconcile: Safely remove any stale or duplicate test cases belonging strictly to this seeded problem
      // that are not part of the canonical 6 seeded test cases. Does NOT touch user-created problems or unrelated test cases.
      await TestCase.deleteMany({
        problemId: problem._id,
        _id: { $nin: seededTcIds }
      });
    }

    // 3. Print Concise Summary
    console.log('Seed completed successfully.\n');
    console.log('Users:');
    console.log('- USER: 1');
    console.log('- ADMIN: 1\n');
    console.log('Problems:');
    console.log(`- EASY: ${easyCount}`);
    console.log(`- MEDIUM: ${mediumCount}`);
    console.log(`- HARD: ${hardCount}`);
    console.log(`- Total: ${easyCount + mediumCount + hardCount}\n`);
    console.log('Test Cases:');
    console.log(`- PUBLIC: ${publicTcCount}`);
    console.log(`- HIDDEN: ${hiddenTcCount}`);
    console.log(`- Total: ${publicTcCount + hiddenTcCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error] Failed to complete database seeding:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = {
  seed,
  SEED_USERS,
  SEED_PROBLEMS
};
