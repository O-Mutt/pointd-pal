import { AllMiddlewareArgs, BlockButtonAction, SlackActionMiddlewareArgs, SayArguments, RespondArguments } from "@slack/bolt";
import { Md } from "slack-block-builder";
import { app } from "../app";
import { BonuslyService } from "./lib/services/bonusly";
import { eventBus } from "./lib/services/eventBus";
import { actions } from "./lib/types/Actions";
import { PlusPlus, PlusPlusBonuslyEventName } from "./lib/types/Events";

app.action(actions.bonusly.prompt_confirm, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  const plusPlusEvent: PlusPlus = JSON.parse(actionArgs.payload.value) as PlusPlus;
  console.error(plusPlusEvent);
  const responses: any[] = await BonuslyService.sendBonus(plusPlusEvent.teamId, plusPlusEvent.sender, plusPlusEvent.recipients, plusPlusEvent.amount, plusPlusEvent.reason);
  eventBus.emit(PlusPlusBonuslyEventName, { responses, plusPlusEvent, sender: plusPlusEvent.sender });
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} Bonusly sent.`, delete_original: true } as RespondArguments)
});

app.action(actions.bonusly.prompt_cancel, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} No bonusly sent.`, delete_original: true } as RespondArguments)
});