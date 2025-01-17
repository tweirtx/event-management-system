import * as React from "react";
import {Button, Card, Checkbox, CheckboxProps, Divider, Table} from "semantic-ui-react";
import {getTheme} from "../AppTheme";
import {IApplicationState} from "../stores";
import {connect} from "react-redux";
import {IDisableNavigation} from "../stores/internal/types";
import ConfirmActionModal from "./ConfirmActionModal";
import {SyntheticEvent} from "react";
import {EventConfiguration, Match, TOAConfig, TournamentType, TournamentRound} from "@the-orange-alliance/lib-ems";

interface IProps {
  onComplete: (postOnline: boolean) => void,
  toaConfig?: TOAConfig,
  type: TournamentType,
  matchList: Match[],
  eventConfig?: EventConfiguration,
  navigationDisabled?: boolean,
  tournamentRound?: TournamentRound,
  setNavigationDisabled?: (disabled: boolean) => IDisableNavigation
}

interface IState {
  confirmModalOpen: boolean,
  postOnline: boolean
}

class SetupMatchScheduleOverview extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      confirmModalOpen: false,
      postOnline: this.props.toaConfig.enabled
    };
    this.openConfirmModal = this.openConfirmModal.bind(this);
    this.closeConfirmModal = this.closeConfirmModal.bind(this);
    this.publish = this.publish.bind(this);
    this.modifyTOAEnabled = this.modifyTOAEnabled.bind(this);
  }

  public render() {
    const {eventConfig, matchList, toaConfig, tournamentRound, type} = this.props;
    const {confirmModalOpen} = this.state;
    let matches: Match[] = matchList;
    let tpa: number;
    if (tournamentRound) {
      tpa = tournamentRound.format.teamsPerAlliance;
      matches = matches.filter((m: Match) => m.matchKey.split("-")[3].substring(1, 2) === (tournamentRound.id + ""));
    } else {
      tpa = eventConfig.teamsPerAlliance;
    }

    const redLabels = [];
    for (let i = 0; i < tpa; i++) {
      redLabels.push(
        <Table.HeaderCell key={i + "-red"} width={2}>Red {i + 1}</Table.HeaderCell>
      );
    }

    const blueLabels = [];
    for (let i = 0; i < tpa; i++) {
      blueLabels.push(
        <Table.HeaderCell key={i + "-blue"} width={2}>Blue {i + 1}</Table.HeaderCell>
      );
    }

    const matchesView = matches.map(match => {
      let participantsView: any[] = [];
      if (typeof match.participants === "undefined") {
        for (let i = 0; i < (tpa * 2); i++) {
          participantsView.push(
            <Table.Cell key={match.matchKey + "-" + i} width={2}><b>TBD</b></Table.Cell>
          );
        }
      } else {
        participantsView = match.participants.map(participant => {
          return (
            <Table.Cell key={participant.matchParticipantKey} width={2}>{participant.surrogate ? (participant.teamKey + "*") : participant.teamKey}</Table.Cell>
          );
        });
      }
      return (
        <Table.Row key={match.matchKey}>
          <Table.Cell width={2}>{match.matchName}</Table.Cell>
          <Table.Cell width={1}>{match.fieldNumber}</Table.Cell>
          <Table.Cell width={1}>{match.scheduledStartTime.format("ddd, h:mma")}</Table.Cell>
          {participantsView}
        </Table.Row>
      );
    });

    return (
      <div className="step-view-tab">
        <ConfirmActionModal open={confirmModalOpen} onClose={this.closeConfirmModal} onConfirm={this.publish} innerText={`You are about to post the ${type.toString().toLowerCase()} match schedule. This can only be done once. Are you sure you wish to perform this action?`}/>
        <Card fluid={true} color={getTheme().secondary}>
          <Card.Content>
            {
              matches.length > 0 &&
              <span><i>The following match schedule was generated by given the parameters in the 'Match Maker Parameters' tab. Make sure the schedule generate <b>properly</b>, and then scroll to the bottom to publish the schedule. <b>This schedule can only be published once.</b></i></span>
            }
            {
              matches.length === 0 &&
              <span className={"error-text"}><i>There is currently no generated {this.props.type.toString().toLowerCase()} match schedule. Generate one from the 'Match Maker Parameters' tab.</i></span>
            }
          </Card.Content>
          <Card.Content>
            <Table color={getTheme().secondary} attached={true} celled={true} textAlign="center" columns={16}>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell width={2}>Match</Table.HeaderCell>
                  <Table.HeaderCell width={1}>Field</Table.HeaderCell>
                  <Table.HeaderCell width={1}>Time</Table.HeaderCell>
                  {redLabels}
                  {blueLabels}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {matchesView}
              </Table.Body>
            </Table>
            <Divider/>
            {
              matches.length > 0 &&
              <Button color={getTheme().primary} loading={this.props.navigationDisabled} disabled={this.props.navigationDisabled} onClick={this.openConfirmModal}>Save &amp; Publish</Button>
            }
            {
              toaConfig.enabled &&
              <Checkbox label={"Post schedule to TOA"} checked={this.state.postOnline} onChange={this.modifyTOAEnabled}/>
            }
          </Card.Content>
        </Card>
      </div>
    );
  }

  private modifyTOAEnabled(event: SyntheticEvent, props: CheckboxProps) {
    this.setState({postOnline: props.checked});
  }

  private openConfirmModal() {
    this.setState({confirmModalOpen: true});
  }

  private closeConfirmModal() {
    this.setState({confirmModalOpen: false});
  }

  private publish() {
    this.closeConfirmModal();
    this.props.onComplete(this.state.postOnline);
  }
}

export function mapStateToProps({configState, internalState}: IApplicationState) {
  return {
    eventConfig: configState.eventConfiguration,
    toaConfig: configState.toaConfig,
    navigationDisabled: internalState.navigationDisabled
  };
}

export default connect(mapStateToProps)(SetupMatchScheduleOverview);