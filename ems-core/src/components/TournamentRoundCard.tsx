import * as React from "react";
import {
  EliminationMatchesFormat, PlayoffsType, RankingMatchesFormat, RoundRobinFormat,
  TournamentRound
} from "@the-orange-alliance/lib-ems";
import {Button, Card, Grid, Input} from "semantic-ui-react";
import {getTheme} from "../AppTheme";
import TournamentResultsModal from "./TournamentResultsModal";

interface IProps {
  round: TournamentRound
  onActivate?: () => void
  onAdvanceTeams?: (teamKeys: number[]) => void;
}

interface IState {
  resultsModalOpen: boolean;
}

class TournamentRoundCard extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);

    this.state = {
      resultsModalOpen: false
    };

    this.openResultsModal = this.openResultsModal.bind(this);
    this.closeResultsModal = this.closeResultsModal.bind(this);
  }

  public render() {
    const {round} = this.props;
    const cardView = this.getViewByType(round.type);
    return (cardView);
  }

  private getViewByType(type: PlayoffsType) {
    const {round} = this.props;
    switch (type) {
      case "elims":
        return this.renderElimsCard(round.id, round.format as EliminationMatchesFormat);
      case "ranking":
        return this.renderRankingCard(round.id, round.format as RankingMatchesFormat);
      case "rr":
        return this.renderRoundRobinCard(round.id, round.format as RoundRobinFormat);
        // TODO - Render default?
    }
  }

  private renderElimsCard(id: number, round: EliminationMatchesFormat) {
    let seriesLabel: string;

    switch (round.seriesType) {
      case "bo1":
        seriesLabel = "Best of 1";
        break;
      case "bo3":
        seriesLabel = "Best of 3";
        break;
      case "bo5":
        seriesLabel = "Best of 5";
        break;
      default:
        seriesLabel = "";
    }

    return (
      <Card fluid={true} color={getTheme().secondary}>
        <Card.Content>
          <b>{id}. Eliminations Tournament</b>
        </Card.Content>
        <Card.Content>
          <Grid columns={2}>
            <Grid.Row>
              <Grid.Column className={"center-left-items"}>Series Type</Grid.Column>
              <Grid.Column><Input value={seriesLabel} disabled={true}/></Grid.Column>
            </Grid.Row>
            <Grid.Row>
              <Grid.Column className={"center-left-items"}>Alliance Captains</Grid.Column>
              <Grid.Column><Input value={round.alliances} disabled={true}/></Grid.Column>
            </Grid.Row>
            <Grid.Row>
              <Grid.Column className={"center-left-items"}>Teams Per Alliance</Grid.Column>
              <Grid.Column><Input value={round.teamsPerAlliance} disabled={true}/></Grid.Column>
            </Grid.Row>
          </Grid>
        </Card.Content>
        {this.renderBottomButtons()}
      </Card>
    );
  }

  private renderRankingCard(id: number, round: RankingMatchesFormat) {
    return (
      <Card fluid={true} color={getTheme().secondary}>
        <Card.Content>
          <b>{id}. Ranking Tournament</b>
        </Card.Content>
        <Card.Content>
          <Grid columns={2}>
            <Grid.Row>
              <Grid.Column className={"center-left-items"}>Ranking Cutoff</Grid.Column>
              <Grid.Column><Input value={round.rankingCutoff} disabled={true}/></Grid.Column>
            </Grid.Row>
            <Grid.Row>
              <Grid.Column className={"center-left-items"}>Teams Per Alliance</Grid.Column>
              <Grid.Column><Input value={round.teamsPerAlliance} disabled={true}/></Grid.Column>
            </Grid.Row>
          </Grid>
        </Card.Content>
        {this.renderBottomButtons()}
      </Card>
    );
  }

  private renderRoundRobinCard(id: number, round: RoundRobinFormat) {
    return (
      <Card fluid={true} color={getTheme().secondary}>
        <Card.Content>
          <b>{id}. Round Robin Tournament</b>
        </Card.Content>
        <Card.Content>
          <Grid columns={2}>
            <Grid.Row>
              <Grid.Column className={"center-left-items"}>Alliances</Grid.Column>
              <Grid.Column><Input value={round.alliances} disabled={true}/></Grid.Column>
            </Grid.Row>
            <Grid.Row>
              <Grid.Column className={"center-left-items"}>Teams Per Alliance</Grid.Column>
              <Grid.Column><Input value={round.teamsPerAlliance} disabled={true}/></Grid.Column>
            </Grid.Row>
          </Grid>
        </Card.Content>
        {this.renderBottomButtons()}
      </Card>
    );
  }

  private renderBottomButtons() {
    const {onActivate, onAdvanceTeams, round} = this.props;
    const {resultsModalOpen} = this.state;
    return (
      <Card.Content>
        <TournamentResultsModal open={resultsModalOpen} tournament={round} onClose={this.closeResultsModal} onTeamsAdvance={onAdvanceTeams}/>
        <Grid columns={2}>
          <Grid.Row>
            <Grid.Column><Button fluid={true} color={getTheme().primary} onClick={onActivate}>Activate</Button></Grid.Column>
            <Grid.Column><Button fluid={true} color={getTheme().primary} onClick={this.openResultsModal}>View Results</Button></Grid.Column>
          </Grid.Row>
        </Grid>
      </Card.Content>
    );
  }

  private openResultsModal() {
    this.setState({resultsModalOpen: true});
  }

  private closeResultsModal() {
    this.setState({resultsModalOpen: false});
  }
}

export default TournamentRoundCard;