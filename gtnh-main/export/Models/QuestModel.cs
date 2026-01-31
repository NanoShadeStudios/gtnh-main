using System;
using Source;

namespace GT_recipe_parser
{
    public class QuestModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("DESCRIPTION")]
        public string Description { get; set; }

        [SchemaName("NAME")]
        public string Name { get; set; }

        [SchemaName("QUEST_ID")]
        public string QuestId { get; set; }

        [SchemaName("QUEST_LOGIC")]
        public string QuestLogic { get; set; }

        [SchemaName("REPEAT_TIME")]
        public int RepeatTime { get; set; }

        [SchemaName("TASK_LOGIC")]
        public string TaskLogic { get; set; }

        [SchemaName("VISIBILITY")]
        public string Visibility { get; set; }

        [SchemaName("ICON_ID")]
        public string IconId { get; set; }
    }

    public class QuestLineModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("DESCRIPTION")]
        public string Description { get; set; }

        [SchemaName("NAME")]
        public string Name { get; set; }

        [SchemaName("QUEST_LINE_ID")]
        public string QuestLineId { get; set; }

        [SchemaName("VISIBILITY")]
        public string Visibility { get; set; }

        [SchemaName("ICON_ID")]
        public string IconId { get; set; }
    }

    public class QuestLineQuestModel
    {
        [SchemaName("QUEST_LINES_ID")]
        public string QuestLinesId { get; set; }

        [SchemaName("QUESTS_ID")]
        public string QuestsId { get; set; }
    }

    public class QuestLineQuestLineEntriesModel
    {
        [SchemaName("QUEST_LINE_ID")]
        public string QuestLineId { get; set; }

        [SchemaName("QUEST_LINE_ENTRIES_POSX")]
        public int QuestLineEntriesPosX { get; set; }

        [SchemaName("QUEST_LINE_ENTRIES_POSY")]
        public int QuestLineEntriesPosY { get; set; }

        [SchemaName("QUEST_LINE_ENTRIES_QUEST_ID")]
        public string QuestLineEntriesQuestId { get; set; }

        [SchemaName("QUEST_LINE_ENTRIES_SIZEX")]
        public int QuestLineEntriesSizeX { get; set; }

        [SchemaName("QUEST_LINE_ENTRIES_SIZEY")]
        public int QuestLineEntriesSizeY { get; set; }
    }

    public class QuestQuestModel
    {
        [SchemaName("REQUIRED_BY_QUESTS_ID")]
        public string RequiredByQuestsId { get; set; }

        [SchemaName("REQUIRED_QUESTS_ID")]
        public string RequiredQuestsId { get; set; }
    }

    public class QuestRewardModel
    {
        [SchemaName("QUEST_ID")]
        public string QuestId { get; set; }

        [SchemaName("REWARDS_ID")]
        public string RewardsId { get; set; }

        [SchemaName("REWARDS_ORDER")]
        public int RewardsOrder { get; set; }
    }

    public class QuestTaskModel
    {
        [SchemaName("QUEST_ID")]
        public string QuestId { get; set; }

        [SchemaName("TASKS_ID")]
        public string TasksId { get; set; }

        [SchemaName("TASKS_ORDER")]
        public int TasksOrder { get; set; }
    }

    public class RewardModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("COMMAND")]
        public string Command { get; set; }

        [SchemaName("COMPLETE_QUEST_ID")]
        public string CompleteQuestId { get; set; }

        [SchemaName("LEVELS")]
        public bool Levels { get; set; }

        [SchemaName("NAME")]
        public string Name { get; set; }

        [SchemaName("TYPE")]
        public string Type { get; set; }

        [SchemaName("XP")]
        public int Xp { get; set; }
    }

    public class RewardItemGroupModel
    {
        [SchemaName("REWARD_ID")]
        public string RewardId { get; set; }

        [SchemaName("ITEMS_ID")]
        public string ItemsId { get; set; }

        [SchemaName("ITEMS_ORDER")]
        public int ItemsOrder { get; set; }
    }

    public class TaskModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("CONSUME")]
        public bool Consume { get; set; }

        [SchemaName("DIMENSION_NAME")]
        public string DimensionName { get; set; }

        [SchemaName("NAME")]
        public string Name { get; set; }

        [SchemaName("NUMBER_REQUIRED")]
        public int NumberRequired { get; set; }

        [SchemaName("TYPE")]
        public string Type { get; set; }

        [SchemaName("MOB_ID")]
        public string MobId { get; set; }
    }

    public class TaskFluidsModel
    {
        [SchemaName("TASK_ID")]
        public string TaskId { get; set; }

        [SchemaName("FLUIDS_AMOUNT")]
        public int FluidsAmount { get; set; }

        [SchemaName("FLUIDS_FLUID_ID")]
        public string FluidsFluidId { get; set; }

        [SchemaName("FLUIDS_ORDER")]
        public int FluidsOrder { get; set; }
    }

    public class TaskItemGroupModel
    {
        [SchemaName("TASK_ID")]
        public string TaskId { get; set; }

        [SchemaName("ITEMS_ID")]
        public string ItemsId { get; set; }

        [SchemaName("ITEMS_ORDER")]
        public int ItemsOrder { get; set; }
    }
}