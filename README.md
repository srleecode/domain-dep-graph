# domain-dep-graph

You can find an example at: https://github.com/srleecode/domain-example

Plugin to extend nrwl nx dep-graph.
It removes layer libraries and replaces them with the domains

nx.json needs to be updated with the compiled version of the domain-dep-graph file which you can copy to your repository

"plugins": ["./tools/domain-dep-graph/domain-dep-graph.js"],
