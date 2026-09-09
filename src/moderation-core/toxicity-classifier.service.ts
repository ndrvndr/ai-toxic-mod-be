import {
  pipeline,
  TextClassificationPipeline,
} from "@huggingface/transformers";
import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";

export interface ToxicityBreakdown {
  toxic: number;
  severe_toxic: number;
  obscene: number;
  threat: number;
  insult: number;
  identity_hate: number;
}

export interface ToxicityClassification {
  score: number;
  label: "safe" | "borderline" | "toxic";
  modelVersion: string;
  breakdown: ToxicityBreakdown;
}

const MODEL_VERSION = "Xenova/toxic-bert";
const NUM_LABELS = 6;

@Injectable()
export class ToxicityClassifierService implements OnModuleInit {
  private readonly logger = new Logger(ToxicityClassifierService.name);
  private classifier!: TextClassificationPipeline;

  async onModuleInit() {
    this.logger.log(`Loading toxicity model: ${MODEL_VERSION}...`);
    this.classifier = await pipeline("text-classification", MODEL_VERSION);
    this.logger.log("Toxicity model loaded.");
  }

  async classify(text: string): Promise<ToxicityClassification> {
    const results = await this.classifier(text, { top_k: NUM_LABELS });
    const outputs = (Array.isArray(results) ? results : [results]) as Array<{
      label: string;
      score: number;
    }>;

    const breakdown = {} as Record<string, number>;
    for (const item of outputs) {
      breakdown[item.label] = item.score;
    }

    const overallScore = breakdown["toxic"] ?? 0;

    return {
      score: overallScore,
      label: this.scoreToLabel(overallScore),
      modelVersion: MODEL_VERSION,
      breakdown: breakdown as unknown as ToxicityBreakdown,
    };
  }

  private scoreToLabel(score: number): "safe" | "borderline" | "toxic" {
    if (score >= 0.7) return "toxic";
    if (score >= 0.4) return "borderline";
    return "safe";
  }
}
