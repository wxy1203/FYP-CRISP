import { Carousel, Embla } from '@mantine/carousel';
import { BarChart } from '@mantine/charts';
import {
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { JiraBoard, JiraIssue, JiraSprint } from '@shared/types/JiraData';
import { User } from '@shared/types/User';
import { useState } from 'react';

interface ProjectManagementCardProps {
  TA: User | null;
  jiraBoard: JiraBoard | null;
}

interface SprintSummary {
  endDate: Date;
  endDateString: string;
  'Story Points Commitment': number;
  'Issues Commitment': number;
  'Story Points Completed': number;
  'Issues Completed': number;
}

interface AssigneeStats {
  assignee: string;
  issues: number;
  storyPoints: number;
  storyPointsPerIssue: number;
}

enum VelocityChartType {
  StoryPoints = 'storyPoints',
  Issues = 'issues',
}

const ProjectManagementCard: React.FC<ProjectManagementCardProps> = ({
  TA,
  jiraBoard,
}) => {
  const [embla, setEmbla] = useState<Embla | null>(null);

  const [selectedVelocityChart, setSelectedVelocityChart] =
    useState<VelocityChartType>(VelocityChartType.StoryPoints); // Default to 'storyPoints'

  const [storyPointsEstimate, setStoryPointsEstimate] = useState<number>(4);

  const handleStoryPointsEstimateChange = (value: string | number) => {
    const newValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(newValue) && newValue >= 0) {
      setStoryPointsEstimate(newValue);
    }
  };

  const getActiveSprintBoard = (
    jiraSprint: JiraSprint | undefined,
    columns: {
      name: string;
    }[]
  ) => {
    return (
      jiraSprint &&
      columns && (
        <Card withBorder>
          <SimpleGrid cols={{ base: 1, xs: columns.length }} mt="md" mb="xs">
            {columns.map((column, index) => (
              <Stack key={index}>
                <Text fw={600} size="sm">
                  {column.name}
                </Text>
                {getJiraBoardColumn(jiraSprint, column.name)}
              </Stack>
            ))}
          </SimpleGrid>
        </Card>
      )
    );
  };

  const getJiraBoardColumn = (jiraSprint: JiraSprint, status: string) => {
    return (
      jiraSprint.jiraIssues &&
      jiraSprint.jiraIssues.map(
        issue =>
          issue.fields.status?.name.toLowerCase() === status.toLowerCase() &&
          getJiraBoardCard(issue)
      )
    );
  };

  const getJiraBoardCard = (issue: JiraIssue) => (
    <Card radius="md" shadow="sm" padding="lg" withBorder>
      <Group style={{ alignItems: 'center' }}>
        <Text fw={600} size="sm">
          {issue.fields.summary || '-'}
        </Text>
      </Group>
      <Group style={{ alignItems: 'center' }}>
        <Text size="sm">Issue Type:</Text>
        <Text size="sm">{issue.fields.issuetype?.name || '-'}</Text>
      </Group>
      <Group style={{ alignItems: 'center' }}>
        <Text size="sm">Story Points:</Text>
        <Text size="sm">{issue.storyPoints || '-'}</Text>
      </Group>
      <Group style={{ alignItems: 'center' }}>
        <Text size="sm">Assignee:</Text>
        <Text size="sm">{issue.fields.assignee?.displayName || '-'}</Text>
      </Group>
    </Card>
  );

  const getStatsTable = (jiraSprints: JiraSprint[]) => {
    const assigneeStatsArrays: Record<string, AssigneeStats[]> = {};

    jiraSprints
      .filter(sprint => sprint.state !== 'future')
      .forEach(jiraSprint => {
        const assigneeStatsMap: Record<string, AssigneeStats> = {};
        let totalIssues = 0;
        let totalStoryPoints = 0;

        jiraSprint.jiraIssues.forEach(issue => {
          const assigneeName =
            issue.fields.assignee?.displayName ?? 'Unassigned';
          if (!assigneeStatsMap[assigneeName]) {
            assigneeStatsMap[assigneeName] = {
              assignee: assigneeName,
              issues: 0,
              storyPoints: 0,
              storyPointsPerIssue: 0,
            };
          }

          assigneeStatsMap[assigneeName].issues++;
          assigneeStatsMap[assigneeName].storyPoints += issue.storyPoints ?? 0;

          // Accumulate total issues and story points
          totalIssues++;
          totalStoryPoints += issue.storyPoints ?? 0;
        });

        assigneeStatsMap['Total'] = {
          assignee: 'Total',
          issues: totalIssues,
          storyPoints: totalStoryPoints,
          storyPointsPerIssue: 0,
        };

        const endKeys = ['Unassigned', 'Total'];

        const assigneeStatsArray: AssigneeStats[] = Object.values(
          assigneeStatsMap
        ).sort((a, b) => {
          // Check if the keys are in the endKeys array
          const indexA = endKeys.indexOf(a.assignee);
          const indexB = endKeys.indexOf(b.assignee);

          // If both keys are in the endKeys array, sort based on their position in the endKeys array
          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }

          // If only one key is in the endKeys array, place it at the end
          if (indexA !== -1) return 1;
          if (indexB !== -1) return -1;

          // For other keys, sort based on the key string (ascending order)
          return a.assignee.localeCompare(b.assignee);
        });

        // Calculate average story points per issue for each assignee
        assigneeStatsArray.forEach(assigneeStats => {
          assigneeStats.storyPointsPerIssue =
            assigneeStats.issues > 0
              ? assigneeStats.storyPoints / assigneeStats.issues
              : 0;
        });

        const endDate = new Date(jiraSprint.endDate);
        assigneeStatsArrays[endDate.toISOString()] = assigneeStatsArray;
      });

    // Get the keys as an array and sort them
    const sortedKeys = Object.keys(assigneeStatsArrays)
      .map(key => new Date(key))
      .sort((a, b) => b.getTime() - a.getTime())
      .map(key => key.toISOString());

    const sortedAssigneeStatsArrays: AssigneeStats[][] = sortedKeys.map(
      key => assigneeStatsArrays[key]
    );

    const rows = (assigneeStatsArray: AssigneeStats[]) =>
      assigneeStatsArray.map(assigneeStats => (
        <Table.Tr key={assigneeStats.assignee}>
          <Table.Td>{assigneeStats.assignee}</Table.Td>
          <Table.Td>{assigneeStats.issues}</Table.Td>
          <Table.Td>{assigneeStats.storyPoints}</Table.Td>
          <Table.Td
            c={
              assigneeStats.storyPointsPerIssue <= 16 / storyPointsEstimate
                ? 'teal.7'
                : 'red.7'
            }
          >
            {assigneeStats.storyPointsPerIssue.toFixed(2)}
          </Table.Td>
        </Table.Tr>
      ));

    return (
      <Card withBorder>
        <NumberInput
          label="Number of hours per story point"
          value={storyPointsEstimate}
          onChange={handleStoryPointsEstimateChange}
          min={1}
          step={1}
          clampBehavior="strict"
          allowNegative={false}
          w={'30%'}
        />
        <Carousel
          controlsOffset="xs"
          slideSize="100%"
          loop
          getEmblaApi={setEmbla}
          nextControlProps={{
            // fix for only first carousel working
            onClick: () => embla?.reInit(),
          }}
          previousControlProps={{
            onClick: () => embla?.reInit(),
          }}
        >
          {sortedAssigneeStatsArrays.map((assigneeStatsArray, index) => (
            <Carousel.Slide key={index}>
              <Group pl={'6%'} pr={'6%'} pt={'2%'}>
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                >
                  <Table.Caption>
                    Sprint ending{' '}
                    {new Date(sortedKeys[index]).toLocaleDateString()}
                  </Table.Caption>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Assignee</Table.Th>
                      <Table.Th>Issues</Table.Th>
                      <Table.Th>Story Points</Table.Th>
                      <Table.Th>Story Points Per Issue</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>{rows(assigneeStatsArray)}</Table.Tbody>
                </Table>
              </Group>
            </Carousel.Slide>
          ))}
        </Carousel>
      </Card>
    );
  };

  const getVelocityChart = (jiraSprints: JiraSprint[]) => {
    const sprintData: SprintSummary[] = [];

    jiraSprints
      .filter(sprint => sprint.state !== 'future')
      .forEach(sprint => {
        const sprintSummary: SprintSummary = {
          endDate: new Date(sprint.endDate),
          endDateString: new Date(sprint.endDate).toLocaleDateString(),
          'Story Points Commitment': 0,
          'Issues Commitment': 0,
          'Story Points Completed': 0,
          'Issues Completed': 0,
        };

        sprint.jiraIssues.forEach(issue => {
          sprintSummary['Issues Commitment'] += 1;
          sprintSummary['Story Points Commitment'] += issue.storyPoints ?? 0;

          if (
            issue.fields.resolution &&
            issue.fields.resolution.name === 'Done'
          ) {
            sprintSummary['Issues Completed'] += 1;
            sprintSummary['Story Points Completed'] += issue.storyPoints ?? 0;
          }
        });

        sprintData.push(sprintSummary);
      });

    sprintData.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

    // Calculate the total completed story points
    const totalCompletedStoryPoints = sprintData.reduce(
      (acc, sprintSummary) => acc + sprintSummary['Story Points Completed'],
      0
    );

    // Calculate the velocity (average completed story points)
    const storyPointsVelocity =
      sprintData.length > 0 ? totalCompletedStoryPoints / sprintData.length : 0;

    // Calculate the total completed issues
    const totalCompletedIssues = sprintData.reduce(
      (acc, sprintSummary) => acc + sprintSummary['Issues Completed'],
      0
    );

    // Calculate the velocity (average completed story points)
    const issuesVelocity =
      sprintData.length > 0 ? totalCompletedIssues / sprintData.length : 0;

    return (
      <Card withBorder>
        <Select
          data={[
            { value: VelocityChartType.StoryPoints, label: 'Story Points' },
            { value: VelocityChartType.Issues, label: 'Issues' },
          ]}
          value={selectedVelocityChart}
          allowDeselect={false}
          onChange={(_value, option) =>
            setSelectedVelocityChart(option.value as VelocityChartType)
          }
          pos={'absolute'}
          top={'15'}
          left={'15'}
        />
        <Text size="sm" fw={500} ta={'center'} mb={'8'}>
          Velocity Chart
        </Text>
        {selectedVelocityChart === VelocityChartType.StoryPoints && (
          <>
            <BarChart
              h={400}
              data={sprintData}
              dataKey="endDateString"
              xAxisLabel="Sprint"
              yAxisLabel="Story Points"
              withLegend
              legendProps={{ verticalAlign: 'top' }}
              series={[
                { name: 'Story Points Commitment', color: 'gray.5' },
                { name: 'Story Points Completed', color: 'teal.7' },
              ]}
            />
            <Group style={{ alignItems: 'center' }}>
              <Text size="sm">Team's Velocity:</Text>
              <Text size="sm">{storyPointsVelocity.toFixed(2)}</Text>
            </Group>
          </>
        )}
        {selectedVelocityChart === VelocityChartType.Issues && (
          <>
            <BarChart
              h={400}
              data={sprintData}
              dataKey="endDateString"
              xAxisLabel="Sprint"
              yAxisLabel="Issues"
              withLegend
              legendProps={{ verticalAlign: 'top' }}
              series={[
                { name: 'Issues Commitment', color: 'gray.5' },
                { name: 'Issues Completed', color: 'teal.7' },
              ]}
            />
            <Group style={{ alignItems: 'center' }}>
              <Text size="sm">Team's Velocity:</Text>
              <Text size="sm">{issuesVelocity.toFixed(2)}</Text>
            </Group>
          </>
        )}
      </Card>
    );
  };

  return (
    <Stack>
      <Group style={{ alignItems: 'center' }}>
        <Text>Teaching Assistant:</Text>
        <Text>{TA ? TA.name : 'None'}</Text>
      </Group>
      <Group style={{ alignItems: 'center' }}>
        <Text>Jira Project:</Text>
        <Text>{jiraBoard ? jiraBoard.jiraLocation.projectName : 'None'}</Text>
      </Group>
      {jiraBoard && (
        <>
          <Group>
            <Text>Current Sprint:</Text>
            {jiraBoard.jiraSprints.map(
              sprint => sprint.state === 'active' && <Text>{sprint.name}</Text>
            )}
          </Group>
          <Group>
            <Text>Start Date:</Text>
            {jiraBoard.jiraSprints.map(sprint => {
              const startDate = new Date(sprint.startDate);
              return (
                sprint.state === 'active' && (
                  <Text>
                    {startDate.toLocaleTimeString()},{' '}
                    {startDate.toLocaleDateString()}
                  </Text>
                )
              );
            })}
          </Group>
          <Group>
            <Text>End Date:</Text>
            {jiraBoard.jiraSprints.map(sprint => {
              const endDate = new Date(sprint.endDate);
              return (
                sprint.state === 'active' && (
                  <Text>
                    {endDate.toLocaleTimeString()},{' '}
                    {endDate.toLocaleDateString()}
                  </Text>
                )
              );
            })}
          </Group>
          {jiraBoard.jiraSprints &&
            getActiveSprintBoard(
              jiraBoard.jiraSprints.find(sprint => sprint.state === 'active'),
              jiraBoard.columns
            )}
          {jiraBoard.jiraSprints && getStatsTable(jiraBoard.jiraSprints)}
          {jiraBoard.jiraSprints && getVelocityChart(jiraBoard.jiraSprints)}
        </>
      )}
    </Stack>
  );
};

export default ProjectManagementCard;
