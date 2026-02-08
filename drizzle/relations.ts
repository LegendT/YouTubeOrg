import { relations } from "drizzle-orm/relations";
import { videos, mlCategorisations, categories, playlists, playlistVideos, analysisSessions, consolidationProposals, duplicateVideos, backupSnapshots, operationLog, syncJobs, syncVideoOperations, categoryVideos } from "./schema";

export const mlCategorisationsRelations = relations(mlCategorisations, ({one}) => ({
	video: one(videos, {
		fields: [mlCategorisations.videoId],
		references: [videos.id]
	}),
	category_suggestedCategoryId: one(categories, {
		fields: [mlCategorisations.suggestedCategoryId],
		references: [categories.id],
		relationName: "mlCategorisations_suggestedCategoryId_categories_id"
	}),
	category_manualCategoryId: one(categories, {
		fields: [mlCategorisations.manualCategoryId],
		references: [categories.id],
		relationName: "mlCategorisations_manualCategoryId_categories_id"
	}),
}));

export const videosRelations = relations(videos, ({many}) => ({
	mlCategorisations: many(mlCategorisations),
	playlistVideos: many(playlistVideos),
	duplicateVideos: many(duplicateVideos),
	syncVideoOperations: many(syncVideoOperations),
	categoryVideos: many(categoryVideos),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	mlCategorisations_suggestedCategoryId: many(mlCategorisations, {
		relationName: "mlCategorisations_suggestedCategoryId_categories_id"
	}),
	mlCategorisations_manualCategoryId: many(mlCategorisations, {
		relationName: "mlCategorisations_manualCategoryId_categories_id"
	}),
	syncVideoOperations: many(syncVideoOperations),
	categoryVideos: many(categoryVideos),
	consolidationProposal: one(consolidationProposals, {
		fields: [categories.sourceProposalId],
		references: [consolidationProposals.id]
	}),
}));

export const playlistVideosRelations = relations(playlistVideos, ({one}) => ({
	playlist: one(playlists, {
		fields: [playlistVideos.playlistId],
		references: [playlists.id]
	}),
	video: one(videos, {
		fields: [playlistVideos.videoId],
		references: [videos.id]
	}),
}));

export const playlistsRelations = relations(playlists, ({many}) => ({
	playlistVideos: many(playlistVideos),
}));

export const consolidationProposalsRelations = relations(consolidationProposals, ({one, many}) => ({
	analysisSession: one(analysisSessions, {
		fields: [consolidationProposals.sessionId],
		references: [analysisSessions.id]
	}),
	categories: many(categories),
}));

export const analysisSessionsRelations = relations(analysisSessions, ({many}) => ({
	consolidationProposals: many(consolidationProposals),
	duplicateVideos: many(duplicateVideos),
}));

export const duplicateVideosRelations = relations(duplicateVideos, ({one}) => ({
	video: one(videos, {
		fields: [duplicateVideos.videoId],
		references: [videos.id]
	}),
	analysisSession: one(analysisSessions, {
		fields: [duplicateVideos.sessionId],
		references: [analysisSessions.id]
	}),
}));

export const operationLogRelations = relations(operationLog, ({one}) => ({
	backupSnapshot: one(backupSnapshots, {
		fields: [operationLog.backupSnapshotId],
		references: [backupSnapshots.id]
	}),
}));

export const backupSnapshotsRelations = relations(backupSnapshots, ({many}) => ({
	operationLogs: many(operationLog),
	syncJobs: many(syncJobs),
}));

export const syncJobsRelations = relations(syncJobs, ({one, many}) => ({
	backupSnapshot: one(backupSnapshots, {
		fields: [syncJobs.backupSnapshotId],
		references: [backupSnapshots.id]
	}),
	syncVideoOperations: many(syncVideoOperations),
}));

export const syncVideoOperationsRelations = relations(syncVideoOperations, ({one}) => ({
	syncJob: one(syncJobs, {
		fields: [syncVideoOperations.syncJobId],
		references: [syncJobs.id]
	}),
	category: one(categories, {
		fields: [syncVideoOperations.categoryId],
		references: [categories.id]
	}),
	video: one(videos, {
		fields: [syncVideoOperations.videoId],
		references: [videos.id]
	}),
}));

export const categoryVideosRelations = relations(categoryVideos, ({one}) => ({
	category: one(categories, {
		fields: [categoryVideos.categoryId],
		references: [categories.id]
	}),
	video: one(videos, {
		fields: [categoryVideos.videoId],
		references: [videos.id]
	}),
}));