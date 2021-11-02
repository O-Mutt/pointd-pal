import { AllMiddlewareArgs, BlockButtonAction, SlackActionMiddlewareArgs, SayArguments, RespondArguments } from "@slack/bolt";
import { Md } from "slack-block-builder";
import { app } from "../app";
import { BonuslyService } from "./lib/services/bonusly";
import { connectionFactory } from "./lib/services/connectionsFactory";
import { eventBus } from "./lib/services/eventBus";
import { actions } from "./lib/types/Actions";
import { BonuslyPayload, PlusPlusBonusly, PlusPlusBonuslyEventName } from "./lib/types/Events";
import { IUser, User } from './lib/models/user';


app.action(actions.bonusly.prompt_confirm, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  const bonuslyPayload = JSON.parse(actionArgs.payload.value) as BonuslyPayload;
  const connection = connectionFactory(bonuslyPayload.teamId);
  const sender = await User(connection).findOneBySlackIdOrCreate(bonuslyPayload.teamId, bonuslyPayload.sender);
  const recipients: IUser[] = [];
  for (const recipient of bonuslyPayload.recipients) {
    const recip = await User(connection).findOneBySlackIdOrCreate(bonuslyPayload.teamId, recipient)
    recipients.push(recip);
  }
  const responses: any[] | undefined =
    await BonuslyService.sendBonus(
      bonuslyPayload.teamId,
      sender.email as string,
      recipients.map(rec => rec.email as string),
      bonuslyPayload.amount,
      bonuslyPayload.reason);
  if (!responses || responses.length < 1) {
    await actionArgs.respond({ text: `${Md.emoji('thumbsdown')} Bonusly sending failed.`, delete_original: true } as RespondArguments);
    return;
  }

  const ppBonusly = new PlusPlusBonusly({
    responses,
    teamId: bonuslyPayload.teamId,
    sender,
    recipients,
    originalMessageTs: bonuslyPayload.originalMessageTs,
    channel: bonuslyPayload.channel
  });
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} Bonusly sent.`, delete_original: true } as RespondArguments)
  eventBus.emit(PlusPlusBonuslyEventName, ppBonusly);
});

app.action(actions.bonusly.prompt_cancel, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} No bonusly sent.`, delete_original: true } as RespondArguments);
});