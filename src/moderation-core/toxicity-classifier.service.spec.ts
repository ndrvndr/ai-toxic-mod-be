import { Test } from "@nestjs/testing";
import { beforeAll, describe, expect, it } from "bun:test";

import { ToxicityClassifierService } from "./toxicity-classifier.service";

describe("ToxicityClassifierService", () => {
  let service: ToxicityClassifierService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [ToxicityClassifierService],
    }).compile();

    service = module.get(ToxicityClassifierService);
    await service.onModuleInit();
  }, 120000);

  it("should classify toxic text correctly", async () => {
    const result = await service.classify("You are a stupid idiot");
    expect(result.label).not.toBe("safe");
  }, 15000);

  it("should classify safe text correctly", async () => {
    const result = await service.classify("Have a wonderful day!");
    expect(result.label).toBe("safe");
  }, 15000);
});
