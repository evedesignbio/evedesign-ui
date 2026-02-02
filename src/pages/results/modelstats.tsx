import {
  ActionIcon,
  Badge,
  CopyButton,
  Divider,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";
import {
  EvaluationScoreName,
  LabeledInstanceTrainTestDatasetSpec,
  ModelStatsSpec,
  PipelineSpec,
  SingleMutationScanSpec,
} from "../../models/design.ts";
import { useMemo, useState } from "react";
import { Plot } from "../../components/plotly";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { reduce } from "d3";

const isObject = (x: any) =>
  typeof x === "object" && x !== null && !Array.isArray(x);

export interface ModelInfo {
  key: string | null;
  citations: string[];
  stats: ModelStatsSpec | null;
  data: LabeledInstanceTrainTestDatasetSpec | any;
  level: number;
}

const parseModelInfo = (obj: any, level: number): ModelInfo[] => {
  let curModelKey: string | null = null;
  let curCitations: string[] = [];
  let curStats: ModelStatsSpec | null = null;
  let curData: any = null;

  const children: object[] = [];
  for (const key in obj) {
    if (key === "key") {
      curModelKey = obj[key];
    } else if (key === "citations") {
      curCitations = obj[key];
    } else if (key === "stats") {
      curStats = obj[key];
    } else if (key === "args") {
      for (const argKey in obj[key]) {
        const argVal = obj[key][argKey];
        if (Array.isArray(argVal)) {
          argVal.forEach((child: any) => {
            if (isObject(child)) {
              children.push(child);
            }
          });
        } else if (isObject(argVal)) {
          children.push(argVal);
        }
      }
    } else if (key === "data") {
      curData = obj[key];
    }
  }

  let curInfo: ModelInfo[] = [];
  if (curCitations?.length > 0 || curStats !== null || curData !== null) {
    curInfo.push({
      key: curModelKey,
      citations: curCitations,
      stats: curStats,
      data: curData,
      level: level,
    });
  }

  return [
    ...curInfo,
    ...children.map((child) => parseModelInfo(child, level + 1)).flat(),
  ];
};

const accumulateStats = (
  spec: PipelineSpec | SingleMutationScanSpec,
): ModelInfo[] => {
  const isMutationScan = spec.key === "single_mutation_scan";

  // accumulate steps first
  if (isMutationScan) {
    return parseModelInfo(spec.scorer, 0);
  } else {
    return spec.steps
      .map((step) => {
        if (step.key === "generate") {
          return parseModelInfo(step.generator, 0);
        } else if (step.key === "score") {
          return parseModelInfo(step.scorer, 0);
        } else if (step.key === "transform") {
          return parseModelInfo(step.transformer, 0);
        } else if (step.key === "analyze") {
          return parseModelInfo(step.analyzer, 0);
        } else {
          return [];
        }
      })
      .flat();
  }
};

export interface ModelstatsModalProps {
  opened: boolean;
  toggleOpened: () => void;
  spec: PipelineSpec | SingleMutationScanSpec;
}

export const ModelStatsModal = ({
  opened,
  toggleOpened,
  spec,
}: ModelstatsModalProps) => {
  const stats = useMemo(() => accumulateStats(spec), [spec]);
  const [selectedModel, setSelectedModel] = useState<string>("0");
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  if (!opened) {
    return null;
  }

  const bgColor =
    computedColorScheme === "dark"
      ? theme.colors.dark[7] // cf. https://mantine.dev/styles/css-variables-list/
      : "#ffffff";

  let contents;
  if (stats.length === 0) {
    contents = <Text c={"dimmed"}>No model summary available</Text>;
  } else {
    const curModel = stats[parseInt(selectedModel)];
    const values = stats.map((info, index) => ({
      label:
        " ".repeat(info.level) + (info.key ? info.key : "(unnamed)"),
      value: `${index}`,
    }));

    let plot = undefined;
    if (curModel.stats?.y_pred && curModel.stats?.y_true) {
      plot = (
        <Plot
          data={
            // note : this unpacking instead of using two traces from above seems to fix odd
            // https://community.plotly.com/t/react-scattergl-drag-issue/87737
            [
              {
                x: curModel.stats?.y_pred,
                y: curModel.stats?.y_true,
                // ids: [...naturalPoints.ids, ...instancePoints.ids],
                // text: [...naturalPoints.text, ...instancePoints.text],
                // hoverinfo: "text",
                type: "scatter",
                mode: "markers",
                marker: {
                  line: { width: 0 },
                },
              },
            ]
          }
          layout={{
            plot_bgcolor: bgColor,
            paper_bgcolor: bgColor,
            // dragmode: "pan",
            autosize: true,
            xaxis: {
              title: {
                text: "Predicted value",
              },
              color: computedColorScheme === "dark" ? "#ccc" : "#000",
              showgrid: false,
              uirevision: 1,
            },
            yaxis: {
              title: {
                text: "Experimental value",
              },
              color: computedColorScheme === "dark" ? "#ccc" : "#000",
              showgrid: false,
              uirevision: 1,
            },
            margin: {
              b: 50,
              l: 50,
              r: 50,
              t: 50,
            },
            hovermode: "closest",
            hoverlabel: {
              bgcolor: computedColorScheme === "dark" ? "#fff" : "#000",
              font: {
                color: computedColorScheme === "dark" ? "#000" : "#fff",
              },
            },
            showlegend: false,
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%" }}
          config={{
            displayModeBar: false,
          }}
        />
      );
    }

    let scores = undefined;
    if (curModel.stats?.scores) {
      let scoreItems = [];
      for (const key in curModel.stats?.scores) {
        let keyText;
        if (key === "r2") {
          keyText = "R²";
        } else {
          keyText = key.substring(0, 1).toUpperCase() + key.substring(1);
        }

        const values = curModel.stats?.scores[key as EvaluationScoreName];
        if (!values) continue;

        const mean = reduce(values, (acc, val) => acc + val, 0) / values.length;
        let stdErrorText = "";
        if (values.length >= 3) {
          const stdDev = Math.sqrt(
            reduce(values, (acc, val) => acc + (val - mean) ** 2, 0) /
              (values.length - 1),
          );
          const stdErr = stdDev / Math.sqrt(values.length);
          stdErrorText = ` ± ${stdErr.toFixed(2)}`;
        }

        scoreItems.push(
          <Group key={key}>
            <Text>{keyText}</Text>
            <Divider orientation="vertical" color={"blue"} />
            <Text>
              {mean.toFixed(2)}
              {stdErrorText}
            </Text>
          </Group>,
        );
      }
      if (scoreItems.length > 0) {
        scores = (
          <Group align={"top"}>
            <div style={{ width: "80px" }}>
              <Text fw={700}>Scores</Text>
            </div>
            <Stack justify={"space-between"} align={"flex-end"} gap={"xs"}>{scoreItems}</Stack>
          </Group>
        );
      }
    }

    let citations = undefined;
    if (curModel.citations?.length > 0) {
      citations = (
        <Group>
          <div style={{ width: "80px" }}>
            <Text fw={700}>Citations</Text>
          </div>
          {curModel.citations.map((citation, index) => (
            <Badge variant={"outline"} key={index}>
              {citation}
            </Badge>
          ))}
          <CopyButton value={curModel.citations.join("; ")} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? "Copied citations" : "Copy citations"}
                withArrow
                position="right"
              >
                <ActionIcon
                  color={copied ? "teal" : "gray"}
                  variant="subtle"
                  onClick={(e) => {
                    copy();
                    e.stopPropagation();
                  }}
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      );
    }

    contents = (
      <Stack>
        <Select
          data={values}
          value={selectedModel}
          checkIconPosition={"right"}
          onChange={(value) => {
            if (value !== null) {
              setSelectedModel(value);
            }
          }}
        />
        {citations}
        {scores}
        {plot}
      </Stack>
    );
  }

  return (
    <Modal
      opened={true}
      onClose={toggleOpened}
      size={"xl"}
      title="Model summary"
    >
      {contents}
    </Modal>
  );
};
