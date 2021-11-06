import { AllMiddlewareArgs, BlockButtonAction, SlackActionMiddlewareArgs, SayArguments, RespondArguments } from "@slack/bolt";
import { Md } from "slack-block-builder";
import { app } from "../app";
import { BonuslyService } from "./lib/services/bonusly";
import { connectionFactory } from "./lib/services/connectionsFactory";
import { eventBus } from "./lib/services/eventBus";
import { actions } from "./lib/types/Actions";
import { TerseBonuslySentPayload, PPBonuslySentEvent, PPBonuslySentEventName } from "./lib/types/Events";
import { IUser, User } from './lib/models/user';


app.action(actions.bonusly.prompt_confirm,
  async ({ payload, ack, respond }: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
    await ack();
    const bonuslyPayload = JSON.parse(payload.value) as TerseBonuslySentPayload;
    const connection = connectionFactory(bonuslyPayload.teamId);
    const sender = await User(connection).findOneBySlackIdOrCreate(bonuslyPayload.teamId, bonuslyPayload.senderId);
    const recipients: IUser[] = [];
    for (const recipient of bonuslyPayload.recipientIds) {
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
      await respond({ text: `${Md.emoji('thumbsdown')} Bonusly sending failed.`, delete_original: true, replace_original: true } as RespondArguments);
      return;
    }

    const ppBonusly: PPBonuslySentEvent = {
      responses,
      teamId: bonuslyPayload.teamId,
      sender,
      recipients,
      originalMessageTs: bonuslyPayload.originalMessageTs,
      originalMessageParentTs: bonuslyPayload.originalMessageParentTs,
      channel: bonuslyPayload.channel
    };
    await respond({ text: `${Md.emoji('ok_hand')} Bonusly sent.`, delete_original: true, replace_original: true, thread_ts: payload.action_ts } as RespondArguments)
    eventBus.emit(PPBonuslySentEventName, ppBonusly);
  });

app.action(actions.bonusly.prompt_cancel, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} No bonusly sent.`, delete_original: true, replace_original: true } as RespondArguments);
});