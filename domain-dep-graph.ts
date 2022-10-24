import {
  ProjectGraph,
  ProjectGraphBuilder,
  ProjectGraphProjectNode,
  FileData,
} from "@nrwl/devkit";

const layerNames = [
  "application",
  "data-access",
  "directive",
  "domain",
  "feature",
  "shell",
  "ui",
  "util",
];

export function processProjectGraph(graph: ProjectGraph): ProjectGraph {
  const builder = new ProjectGraphBuilder(graph);
  const layerNameDomainNameMap = getLayerNameDomainNameMap(graph);
  const domainNameNodeMap = getDomainNameNodeMap(graph, layerNameDomainNameMap);
  addDomainNodes(builder, domainNameNodeMap);
  convertlibE2E(builder, graph, layerNameDomainNameMap);
  removeLayerLibraries(graph, layerNameDomainNameMap);
  convertAppLayerDependencies(graph, layerNameDomainNameMap);
  return builder.getUpdatedProjectGraph();
}

const isLayerLibraryNode = (node: ProjectGraphProjectNode<any>): boolean => {
  if (node.type === "lib") {
    const splitDirectory = node.data.root.split("/");
    const lastFolder: string = splitDirectory[splitDirectory.length - 1];
    return layerNames.some((name) => lastFolder.startsWith(name));
  }
  return false;
};

const getDomainName = (node: ProjectGraphProjectNode<any>): string => {
  if (!node || !isLayerLibraryNode(node)) {
    return "";
  }
  const splitDirectory = node.data.root.split("/");
  const lastDirectoryPath: string = splitDirectory[splitDirectory.length - 1];
  return node.name.replace(new RegExp(`-${lastDirectoryPath}$`), "");
};

const getLayerNameDomainNameMap = (
  graph: ProjectGraph
): Record<string, string> => {
  const layerDomainMap: Record<string, string> = {};
  for (const key in graph.nodes) {
    const node = graph.nodes[key];
    if (isLayerLibraryNode(node)) {
      layerDomainMap[key] = getDomainName(node);
    }
  }
  return layerDomainMap;
};

const getDomainNameNodeMap = (
  graph: ProjectGraph,
  layerNameDomainNameMap: Record<string, string>
): Record<string, ProjectGraphProjectNode> => {
  const domainNameNodeMap: Record<string, ProjectGraphProjectNode> = {};
  for (const layerName in layerNameDomainNameMap) {
    const layerNode = graph.nodes[layerName];
    const domainName = layerNameDomainNameMap[layerName];
    if (!domainNameNodeMap[domainName]) {
      domainNameNodeMap[domainName] = getDomainNode(layerNode);
    }
    const layerFiles = layerNode.data.files.map((file: FileData) =>
      getDomainNodeFile(domainName, file, layerNameDomainNameMap)
    );
    domainNameNodeMap[domainName].data.files = [
      ...layerFiles,
      ...domainNameNodeMap[domainName].data.files,
    ];
  }
  return domainNameNodeMap;
};

const getDomainNodeFile = (
  currDomainName: string,
  layerNodeFile: FileData,
  layerNameDomainNameMap: Record<string, string>
): FileData => ({
  ...layerNodeFile,
  deps: getDepsForDomain(
    layerNodeFile?.deps,
    layerNameDomainNameMap,
    currDomainName
  ),
});

const getDepsForDomain = (
  deps: string[] | undefined,
  layerNameDomainNameMap: Record<string, string>,
  currDomainName?: string
): string[] => {
  const domainDepSet = new Set<string>();
  const domainNamesSet = new Set<string>(Object.values(layerNameDomainNameMap));
  deps?.forEach((dep) => {
    const domainName = domainNamesSet.has(dep)
      ? dep
      : layerNameDomainNameMap[dep];
    if (domainName) {
      if (!domainDepSet.has(domainName) && domainName !== currDomainName) {
        domainDepSet.add(domainName);
      }
    } else {
      domainDepSet.add(dep);
    }
  });
  return Array.from(domainDepSet);
};

const getDomainNode = (
  layerNode: ProjectGraphProjectNode
): ProjectGraphProjectNode => {
  const domainRoot = layerNode.data.root.substring(
    0,
    layerNode.data.root.lastIndexOf("/")
  );
  return {
    name: getDomainName(layerNode),
    type: "lib",
    data: {
      root: domainRoot,
      sourceRoot: domainRoot,
      files: [],
      tags: [],
    },
  };
};

const convertlibE2E = (
  builder: ProjectGraphBuilder,
  graph: ProjectGraph,
  layerNameDomainNameMap: Record<string, string>
): void => {
  for (const key in graph.nodes) {
    if (key.startsWith("e2e-")) {
      const e2eNode = graph.nodes[key];
      e2eNode.type = "e2e";
      e2eNode.data.projectType = "application";
      const domainDeps = getDepsForDomain(
        e2eNode.data.implicitDependencies,
        layerNameDomainNameMap
      );
      e2eNode.data.implicitDependencies = [];
      domainDeps.forEach((dep) => {
        builder.addImplicitDependency(key, dep);
      });
    }
  }
};

const addDomainNodes = (
  builder: ProjectGraphBuilder,
  domainNameNodeMap: Record<string, ProjectGraphProjectNode>
): void =>
  Object.values(domainNameNodeMap).forEach((node) => builder.addNode(node));

const removeLayerLibraries = (
  graph: ProjectGraph,
  layerNameDomainNameMap: Record<string, string>
): void => {
  for (const key in layerNameDomainNameMap) {
    delete graph.nodes[key];
  }
};

const convertAppLayerDependencies = (
  graph: ProjectGraph,
  layerNameDomainNameMap: Record<string, string>
): void => {
  for (const key in graph.nodes) {
    const node = graph.nodes[key];
    if (node.type === "app") {
      node.data.files = node.data.files.map((file: FileData) => ({
        ...file,
        deps: getDepsForDomain(file.deps, layerNameDomainNameMap),
      }));
    }
  }
};
