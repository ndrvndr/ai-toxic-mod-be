import {
  pipeline,
  TextClassificationPipeline,
} from "@huggingface/transformers";
import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";

export interface ToxicityClassification {
  score: number;
  label: "safe" | "borderline" | "toxic";
  modelVersion: string;
}

const MODEL_VERSION = "Xenova/toxic-bert";

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
    const result = await this.classifier(text);
    const output = Array.isArray(result) ? result[0] : result;
    const score = (output as any).score as number;
    const rawLabel = (output as any).label as string;

    const toxicScore = rawLabel.toLowerCase().includes("toxic")
      ? score
      : 1 - score;

    return {
      score: toxicScore,
      label: this.scoreToLabel(toxicScore),
      modelVersion: MODEL_VERSION,
    };
  }

  private scoreToLabel(score: number): "safe" | "borderline" | "toxic" {
    if (score >= 0.7) return "toxic";
    if (score >= 0.4) return "borderline";
    return "safe";
  }
}
