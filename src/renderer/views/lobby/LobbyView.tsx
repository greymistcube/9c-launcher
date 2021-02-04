import {
  Button as ButtonOrigin,
  ButtonProps,
  CircularProgress,
  Container,
  FormHelperText,
  TextField,
} from "@material-ui/core";
import mixpanel from "mixpanel-browser";
import { inject, observer } from "mobx-react";
import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import {
  useActivateMutation,
  useActivationLazyQuery,
} from "../../../generated/graphql";
import { Lobby } from "../../../interfaces/i18n";
import { IStoreContainer } from "../../../interfaces/store";
import { sleep } from "../../../utils";

import { useLocale } from "../../i18n";

import lobbyViewStyle from "./LobbyView.style";

interface ILobbyViewProps extends IStoreContainer {
  onLaunch: () => void;
}

const Button = (
  props: Omit<ButtonProps, "fullWidth" | "variant" | "color">
) => <ButtonOrigin fullWidth variant="contained" color="primary" {...props} />;

const LobbyView = observer((props: ILobbyViewProps) => {
  const classes = lobbyViewStyle();
  const { accountStore, standaloneStore } = props;
  const [
    activation,
    { loading, error: statusError, data: status, refetch: activationRefetch },
  ] = useActivationLazyQuery();
  const [
    activate,
    { data: isActivated, error: activatedError },
  ] = useActivateMutation();
  const [activationKey, setActivationKey] = useState(
    accountStore.activationKey
  );
  const [polling, setPollingState] = useState(false);

  const { locale } = useLocale<Lobby>("lobby");

  const handleActivationKeyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setActivationKey(event.target.value);
    },
    [event]
  );

  const handleActivationKeySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    activateMutation();
  };

  const activateMutation = () => {
    console.log("!! Invoke activateMutation()");
    setPollingState(true);
    activate({
      variables: {
        encodedActivationKey: activationKey,
      },
    })
      .then(async (value) => {
        console.log("!! 1");
        if (!value.data?.activationStatus?.activateAccount) {
          return;
        }

        while (true) {
          console.log("!! 2");
          await sleep(1000);
          const result = await activationRefetch();
          if (result.data.activationStatus.activated) {
            console.log("!! 3"); // NOTE: Not invoked when auto activate.
            break;
          }
        }
      })
      .finally(() => {
        console.log("!! 4");
        setPollingState(false);
      });
  };

  useEffect(() => {
    if (standaloneStore.Ready && standaloneStore.IsSetPrivateKeyEnded) {
      console.log("!! useEffect");
      activation();

      if (activationKey !== "") {
        console.log("!! 0");
        activateMutation();
      }
    }
  }, [standaloneStore.Ready, standaloneStore.IsSetPrivateKeyEnded]);

  let child: JSX.Element;
  if (loading || polling) {
    child = (
      <>
        <p className={classes.verifing}>{locale("확인 중...")}</p>
        <CircularProgress />
      </>
    );
  } else if (!standaloneStore.Ready) {
    child = <PreloadWaitingButton />;
  } else if (status?.activationStatus.activated) {
    child = <GameStartButton {...props} />;
  } else {
    child = (
      <form onSubmit={handleActivationKeySubmit}>
        <TextField
          error={activatedError?.message !== undefined}
          label={locale("invitationCode")}
          onChange={handleActivationKeyChange}
          fullWidth
        />
        {activatedError?.message !== undefined && (
          <FormHelperText>
            {/* FIXME 예외 타입으로 구분해서 메시지 국제화 할 것 */}
            {activatedError?.message
              ?.split("\n")
              ?.shift()
              ?.split(":")
              ?.pop()
              ?.trim()}
          </FormHelperText>
        )}
        <ButtonOrigin
          color="primary"
          variant="contained"
          className={classes.activation}
          type="submit"
        >
          {locale("활성화")}
        </ButtonOrigin>
      </form>
    );
  }
  return <Container>{child}</Container>;
});

const PreloadWaitingButton = () => {
  const { locale } = useLocale<Lobby>("lobby");
  return (
    <Button disabled={true} className={lobbyViewStyle().gameStartButton}>
      {locale("프리로딩 중...")}
    </Button>
  );
};

const GameStartButton = observer((props: ILobbyViewProps) => {
  const { accountStore, gameStore, standaloneStore } = props;
  const classes = lobbyViewStyle();
  const handleStartGame = () => {
    mixpanel.track("Launcher/Unity Player Start");
    gameStore.startGame(accountStore.privateKey);
    props.onLaunch();
  };

  const { locale } = useLocale<Lobby>("lobby");

  useEffect(() => {
    if (standaloneStore.Ready) {
      handleStartGame();
    }
  }, [standaloneStore.Ready]);

  return (
    <Button
      disabled={gameStore.isGameStarted}
      onClick={handleStartGame}
      className={classes.gameStartButton}
      id="start-game"
    >
      {gameStore.isGameStarted
        ? `${locale("실행 중...")}`
        : `${locale("게임 시작하기")}`}
    </Button>
  );
});

export default inject(
  "accountStore",
  "gameStore",
  "standaloneStore"
)(LobbyView);
