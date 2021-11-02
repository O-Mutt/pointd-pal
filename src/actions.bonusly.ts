import { AllMiddlewareArgs, BlockButtonAction, SlackActionMiddlewareArgs, SayArguments, RespondArguments } from "@slack/bolt";
import { Md } from "slack-block-builder";
import { app } from "../app";
import { BonuslyService } from "./lib/services/bonusly";
import { eventBus } from "./lib/services/eventBus";
import { actions } from "./lib/types/Actions";
import { PlusPlusBonusly, PlusPlusBonuslyEventName } from "./lib/types/Events";


export interface BonuslyPayload {
  teamId: string,
  channel: string,
  senderEmail: string,
  senderSlackId: string,
  recipientEmails: string[],
  recipientSlackIds: string[],
  amount: number,
  originalMessage: string,
  originalMessageTs: string,
  reason?: string
};

app.action(actions.bonusly.prompt_confirm, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  const bonuslyPayload: BonuslyPayload = JSON.parse(actionArgs.payload.value) as BonuslyPayload;
  const responses: any[] | undefined =
    await BonuslyService.sendBonus(
      bonuslyPayload.teamId,
      bonuslyPayload.senderEmail,
      bonuslyPayload.recipientEmails,
      bonuslyPayload.amount,
      bonuslyPayload.reason);
  if (!responses || responses.length < 1) {
    await actionArgs.respond({ text: `${Md.emoji('thumbsdown')} Bonusly sending failed.`, delete_original: true } as RespondArguments);
    return;
  }

  const ppBonusly = new PlusPlusBonusly({
    responses,
    bonuslyPayload
  })
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} Bonusly sent.`, delete_original: true } as RespondArguments)
  eventBus.emit(PlusPlusBonuslyEventName, ppBonusly);
});

app.action(actions.bonusly.prompt_cancel, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} No bonusly sent.`, delete_original: true } as RespondArguments);
});