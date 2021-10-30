import { AllMiddlewareArgs, BlockButtonAction, SlackActionMiddlewareArgs, SayArguments, RespondArguments } from "@slack/bolt";
import { Md } from "slack-block-builder";
import { app } from "../app";
import { BonuslyService } from "./lib/services/bonusly";
import { eventBus } from "./lib/services/eventBus";
import { actions } from "./lib/types/Actions";
import { PlusPlus, PlusPlusBonusly, PlusPlusBonuslyEventName } from "./lib/types/Events";

app.action(actions.bonusly.prompt_confirm, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  const plusPlusEvent: PlusPlus = JSON.parse(actionArgs.payload.value) as PlusPlus;
  console.error(plusPlusEvent);
  let responses: any[] | undefined = await BonuslyService.sendBonus(plusPlusEvent.teamId, plusPlusEvent.sender, plusPlusEvent.recipients, plusPlusEvent.amount, plusPlusEvent.reason);
  if (!responses) {
    await actionArgs.respond({ text: `${Md.emoji('thumbs_down')} No bonusly sent, there is an issue with the config.`, delete_original: false } as RespondArguments);
  }
  responses = responses as any[];
  const ppBonusly = new PlusPlusBonusly({
    responses,
    plusPlusEvent,
    sender: plusPlusEvent.sender
  })
  eventBus.emit(PlusPlusBonuslyEventName, ppBonusly);
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} Bonusly sent.`, delete_original: true } as RespondArguments)
});

app.action(actions.bonusly.prompt_cancel, async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
  await actionArgs.ack();
  await actionArgs.respond({ text: `${Md.emoji('ok_hand')} No bonusly sent.`, delete_original: true } as RespondArguments);
});