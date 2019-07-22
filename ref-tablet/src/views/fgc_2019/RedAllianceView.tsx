import * as React from "react";
import StatusBar from "../../components/StatusBar";
import {Event, Match, MatchParticipant, OceanOpportunitiesMatchDetails, SocketProvider} from "@the-orange-alliance/lib-ems";
import {Col, Nav, NavItem, NavLink, Row, Spinner} from "reactstrap";
import RobotCardStatus from "../../components/RobotCardStatus";
import RobotPenaltyInput from "../../components/RobotPenaltyInput";
import RobotNumberInput from "../../components/RobotNumberInput";
import RobotButtonGroup from "../../components/RobotButtonGroup";

interface IProps {
  event: Event,
  match: Match,
  mode: string,
  connected: boolean
}

interface IState {
  currentMode: number,
  match: Match,
  waitingForMatch: boolean
}

class RedAllianceView extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      currentMode: 0,
      match: this.props.match,
      waitingForMatch: true
    };

    this.changeModeTab = this.changeModeTab.bind(this);
    this.changeRobotOneDocking = this.changeRobotOneDocking.bind(this);
    this.changeRobotTwoDocking = this.changeRobotTwoDocking.bind(this);
    this.changeRobotThreeDocking = this.changeRobotThreeDocking.bind(this);
    this.changeProcessingBargeRecovery = this.changeProcessingBargeRecovery.bind(this);
    this.changeProcessingBargeRecycle = this.changeProcessingBargeRecycle.bind(this);
    this.changeProcessingBargeReuse = this.changeProcessingBargeReuse.bind(this);
    this.changeReductionProcessing = this.changeReductionProcessing.bind(this);
    this.updateRobotCard = this.updateRobotCard.bind(this);
    this.changeMinorPenalties = this.changeMinorPenalties.bind(this);
  }

  public componentWillMount() {
    SocketProvider.on("score-update", (matchJSON: any) => {
      const oldMatch = this.props.match;
      const match: Match = new Match().fromJSON(matchJSON);
      const seasonKey: string = match.matchKey.split("-")[0];
      match.matchDetails = Match.getDetailsFromSeasonKey(seasonKey).fromJSON(matchJSON.details);
      match.participants = matchJSON.participants.map((pJSON: any) => new MatchParticipant().fromJSON(pJSON));
      match.participants.sort((a: MatchParticipant, b: MatchParticipant) => a.station - b.station);
      for (let i = 0; i < match.participants.length; i++) {
        if (typeof oldMatch.participants !== "undefined") {
          match.participants[i].team = oldMatch.participants[i].team; // Both are sorted by station, so we can safely assume/do this.
        }
      }
      this.setState({match: match});
    });

    if (typeof this.props.match.matchDetails === "undefined") {
      this.props.match.matchDetails = new OceanOpportunitiesMatchDetails();
    }
    if (typeof this.props.match.participants === "undefined") {
      this.props.match.participants = [];
    }
    SocketProvider.on("prestart-cancel", () => {
      this.setState({waitingForMatch: true});
    });
    SocketProvider.on("commit-scores-response", () => {
      this.setState({waitingForMatch: true});
    });
  }

  public componentWillUnmount() {
    SocketProvider.off("score-update");
    SocketProvider.off("prestart-cancel");
  }

  public componentDidMount() {
    if (this.state.waitingForMatch && this.props.match.matchKey.length > 0) {
      this.setState({waitingForMatch: false});
    }
  }

  public componentDidUpdate(prevProps: IProps, prevState: IState) {
    if (prevProps.match !== this.props.match) {
      // A change in match has been detected.
      this.setState({match: this.props.match, waitingForMatch: false});
    }
  }

  public render() {
    const {mode, connected} = this.props;
    const {currentMode, match, waitingForMatch} = this.state;
    // const disabled = mode === "";

    let modeView: JSX.Element;

    if (waitingForMatch) {
      modeView = (
        <div id={"spinner-container"}>
          <span>Waiting For a Match...</span>
          <Spinner
            color={"success"}
            style={{ width: '7rem', height: '7rem' }}
          />
        </div>
      );
    } else {
      switch (currentMode) {
        case 0:
          modeView = this.renderTeleView();
          break;
        case 1:
          modeView = this.renderEndView();
          break;
        case 2:
          modeView = this.renderPenaltyView();
          break;
        default:
          modeView = this.renderTeleView();
      }
    }

    return (
      <div className={"alliance-view"}>
        <StatusBar match={match} mode={mode} connected={connected}/>
        <Nav tabs={true}>
          <NavItem>
            <NavLink active={currentMode === 0} href="#" onClick={this.changeModeTab.bind(this, 0)}>TELEOP</NavLink>
          </NavItem>
          <NavItem>
            <NavLink active={currentMode === 1} href="#" onClick={this.changeModeTab.bind(this, 1)}>ENDGAME</NavLink>
          </NavItem>
          <NavItem>
            <NavLink active={currentMode === 2} href="#" onClick={this.changeModeTab.bind(this, 2)}>CARDS/PENALTIES</NavLink>
          </NavItem>
        </Nav>
        {modeView}
      </div>
    );
  }

  private renderTeleView(): JSX.Element {
    const {match} = this.state;
    const reusePollutants = (match.matchDetails as OceanOpportunitiesMatchDetails).redProcessingBargeReuse;
    const recyclePollutants = (match.matchDetails as OceanOpportunitiesMatchDetails).redProcessingBargeRecycle;
    const recoveryPollutants = (match.matchDetails as OceanOpportunitiesMatchDetails).redProcessingBargeRecovery;
    const reductionPollutants = (match.matchDetails as OceanOpportunitiesMatchDetails).redReductionProcessing;
    return (
      <div>
        <Row>
          <Col sm={6}>
            <RobotNumberInput value={reusePollutants} image={"https://via.placeholder.com/150"} min={0} max={30} onChange={this.changeProcessingBargeReuse}/>
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <RobotNumberInput value={recyclePollutants} image={"https://via.placeholder.com/150"} min={0} max={30} onChange={this.changeProcessingBargeRecycle}/>
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <RobotNumberInput value={recoveryPollutants} image={"https://via.placeholder.com/150"} min={0} max={30} onChange={this.changeProcessingBargeRecovery}/>
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <RobotNumberInput value={reductionPollutants} image={"https://via.placeholder.com/150"} min={0} max={30} onChange={this.changeReductionProcessing}/>
          </Col>
        </Row>
      </div>
    );
  }

  private renderEndView(): JSX.Element {
    const {match} = this.state;
    const robotOneDocking = (match.matchDetails as OceanOpportunitiesMatchDetails).redEndRobotOneDocking;
    const robotTwoDocking = (match.matchDetails as OceanOpportunitiesMatchDetails).redEndRobotTwoDocking;
    const robotThreeDocking = (match.matchDetails as OceanOpportunitiesMatchDetails).redEndRobotThreeDocking;
    const redParticipants: MatchParticipant[] = match.participants.length > 0 ? match.participants.filter((p: MatchParticipant) => p.station < 20) : [];

    return (
      <div>
        <Row>
          <Col sm={6}>
            <RobotButtonGroup value={robotOneDocking} participant={redParticipants[0]} states={["None", "Partial", "Full", "Elevated"]} onChange={this.changeRobotOneDocking}/>
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <RobotButtonGroup value={robotTwoDocking} participant={redParticipants[1]} states={["None", "Partial", "Full", "Elevated"]} onChange={this.changeRobotTwoDocking}/>
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <RobotButtonGroup value={robotThreeDocking} participant={redParticipants[2]} states={["None", "Partial", "Full", "Elevated"]} onChange={this.changeRobotThreeDocking}/>
          </Col>
        </Row>
      </div>
    );
  }

  private renderPenaltyView(): JSX.Element {
    const {match} = this.state;
    const minorPenalties = match.redMinPen || 0;
    const redParticipants: MatchParticipant[] = match.participants.length > 0 ? match.participants.filter((p: MatchParticipant) => p.station < 20) : [];

    const participantCards = redParticipants.map((p: MatchParticipant) => {
      return (
        <Col key={p.matchParticipantKey} sm={6}>
          <RobotCardStatus participant={p} onUpdate={this.updateRobotCard}/>
        </Col>
      );
    });
    return (
      <div>
        <Row>
          {participantCards}
        </Row>
        <Row>
          <Col sm={6}>
            <RobotPenaltyInput value={minorPenalties} label={"Minor Penalties"} min={0} max={255} onChange={this.changeMinorPenalties}/>
          </Col>
        </Row>
      </div>
    );
  }

  private changeModeTab(index: number) {
    this.setState({currentMode: index});
  }

  private changeProcessingBargeReuse(n: number) {
    const details: OceanOpportunitiesMatchDetails = this.state.match.matchDetails as OceanOpportunitiesMatchDetails;
    details.redProcessingBargeReuse += n;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private changeProcessingBargeRecycle(n: number) {
    const details: OceanOpportunitiesMatchDetails = this.state.match.matchDetails as OceanOpportunitiesMatchDetails;
    details.redProcessingBargeRecycle += n;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private changeProcessingBargeRecovery(n: number) {
    const details: OceanOpportunitiesMatchDetails = this.state.match.matchDetails as OceanOpportunitiesMatchDetails;
    details.redProcessingBargeRecovery += n;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private changeReductionProcessing(n: number) {
    const details: OceanOpportunitiesMatchDetails = this.state.match.matchDetails as OceanOpportunitiesMatchDetails;
    details.redReductionProcessing += n;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private changeRobotOneDocking(state: number) {
    const details: OceanOpportunitiesMatchDetails = this.state.match.matchDetails as OceanOpportunitiesMatchDetails;
    details.redEndRobotOneDocking = state;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private changeRobotTwoDocking(state: number) {
    const details: OceanOpportunitiesMatchDetails = this.state.match.matchDetails as OceanOpportunitiesMatchDetails;
    details.redEndRobotTwoDocking = state;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private changeRobotThreeDocking(state: number) {
    const details: OceanOpportunitiesMatchDetails = this.state.match.matchDetails as OceanOpportunitiesMatchDetails;
    details.redEndRobotThreeDocking = state;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private changeMinorPenalties(n: number) {
    this.state.match.redMinPen += n;
    this.forceUpdate();
    this.sendUpdatedScore();
  }

  private updateRobotCard(participant: MatchParticipant, cardStatus: number) {
    const participants: MatchParticipant[] = this.state.match.participants.filter((p: MatchParticipant) => p.matchParticipantKey === participant.matchParticipantKey);
    let pIndex: number = 0;
    if (participants.length > 0) {
      pIndex = this.state.match.participants.indexOf(participants[0]);
      const prevState = this.state.match.participants[pIndex].cardStatus;
      this.state.match.participants[pIndex].cardStatus = cardStatus;
      if (cardStatus === 1) {
        this.changeMinorPenalties(1);
      } else if (cardStatus !== 1 && prevState === 1) {
        this.changeMinorPenalties(-1);
      } else {
        this.sendUpdatedScore();
      }
    } else {
      // Do Nothing
    }
  }

  private sendUpdatedScore() {
    const {match} = this.state;
    const matchJSON: any = match.toJSON();
    matchJSON.details = match.matchDetails.toJSON();
    matchJSON.participants = match.participants.map((p: MatchParticipant) => p.toJSON());
    SocketProvider.emit("score-update", matchJSON);
    this.forceUpdate();
  }
}

export default RedAllianceView;