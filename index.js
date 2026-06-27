const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const USER_ID = "Abhishek_2310990348"; 
const EMAIL = "abhishek0348.be23@chitkara.edu.in";       
const ROLL = "2310990348";       

function isValidEntry(entry) {
  const trimmed = entry.trim();
  const regex = /^([A-Z])->([A-Z])$/;
  const match = trimmed.match(regex);
  if (!match) return false;
  if (match[1] === match[2]) return false; // self-loop
  return true;
}

function hasCycle(node, children, visited, stack) {
  visited.add(node);
  stack.add(node);
  for (const child of (children[node] || [])) {
    if (!visited.has(child)) {
      if (hasCycle(child, children, visited, stack)) return true;
    } else if (stack.has(child)) {
      return true;
    }
  }
  stack.delete(node);
  return false;
}

function buildTree(node, children) {
  const obj = {};
  for (const child of (children[node] || [])) {
    obj[child] = buildTree(child, children);
  }
  return obj;
}

function getDepth(node, children) {
  if (!children[node] || children[node].length === 0) return 1;
  return 1 + Math.max(...children[node].map(c => getDepth(c, children)));
}

app.post("/bfhl", (req, res) => {
  const { data } = req.body;

  const invalid_entries = [];
  const duplicate_edges = [];
  const seenEdges = new Set();
  const validEdges = [];

  for (const entry of data) {
    const trimmed = entry.trim();
    if (!isValidEntry(trimmed)) {
      invalid_entries.push(entry);
      continue;
    }
    if (seenEdges.has(trimmed)) {
      if (!duplicate_edges.includes(trimmed)) {
        duplicate_edges.push(trimmed);
      }
      continue;
    }
    seenEdges.add(trimmed);
    validEdges.push(trimmed);
  }

  // Build adjacency
  const children = {};   // parent -> [children]
  const parentCount = {}; // child -> first parent

  for (const edge of validEdges) {
    const [parent, child] = edge.split("->");
    if (!children[parent]) children[parent] = [];
    if (parentCount[child] === undefined) {
      parentCount[child] = parent;
      children[parent].push(child);
    }
    // else: multi-parent — silently discard
  }

  // Collect all nodes
  const allNodes = new Set();
  for (const edge of validEdges) {
    const [p, c] = edge.split("->");
    allNodes.add(p);
    allNodes.add(c);
  }

  // Find roots (never appear as child)
  const childNodes = new Set(Object.keys(parentCount));
  const roots = [...allNodes].filter(n => !childNodes.has(n)).sort();

  // Group nodes into connected components using union-find
  const parent = {};
  const find = (x) => {
    if (parent[x] === undefined) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a, b) => { parent[find(a)] = find(b); };

  for (const edge of validEdges) {
    const [p, c] = edge.split("->");
    union(p, c);
  }

  const groups = {};
  for (const node of allNodes) {
    const root = find(node);
    if (!groups[root]) groups[root] = new Set();
    groups[root].add(node);
  }

  const hierarchies = [];

  for (const groupKey of Object.keys(groups)) {
    const groupNodes = groups[groupKey];

    // Find root of this group
    const groupRoots = [...groupNodes].filter(n => !childNodes.has(n)).sort();
    let treeRoot;
    if (groupRoots.length > 0) {
      treeRoot = groupRoots[0];
    } else {
      // pure cycle — lexicographically smallest
      treeRoot = [...groupNodes].sort()[0];
    }

    // Check cycle
    const visited = new Set();
    const stack = new Set();
    let cycleFound = false;
    for (const node of groupNodes) {
      if (!visited.has(node)) {
        if (hasCycle(node, children, visited, stack)) {
          cycleFound = true;
          break;
        }
      }
    }

    if (cycleFound) {
      hierarchies.push({ root: treeRoot, tree: {}, has_cycle: true });
    } else {
      const tree = { [treeRoot]: buildTree(treeRoot, children) };
      const depth = getDepth(treeRoot, children);
      hierarchies.push({ root: treeRoot, tree, depth });
    }
  }

  // Sort hierarchies by root alphabetically for consistency
  hierarchies.sort((a, b) => a.root.localeCompare(b.root));

  // Summary
  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic = hierarchies.filter(h => h.has_cycle);

  let largest_tree_root = "";
  if (nonCyclic.length > 0) {
    nonCyclic.sort((a, b) => {
      if (b.depth !== a.depth) return b.depth - a.depth;
      return a.root.localeCompare(b.root);
    });
    largest_tree_root = nonCyclic[0].root;
  }

  res.json({
    user_id: USER_ID,
    email_id: EMAIL,
    college_roll_number: ROLL,
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: {
      total_trees: nonCyclic.length,
      total_cycles: cyclic.length,
      largest_tree_root,
    },
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));