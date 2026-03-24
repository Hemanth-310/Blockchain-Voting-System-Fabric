'use strict';

const { Contract } = require('fabric-contract-api');

class VotingSystem extends Contract {

    async CreateElection(ctx, electionId, electionName, candidates) {
        const existing = await ctx.stub.getState(electionId);
        if (existing && existing.length > 0) {
            throw new Error(`Election ${electionId} already exists`);
        }
        const candidateList = candidates.split(',');
        const election = {
            electionId,
            electionName,
            candidates: candidateList,
            status: 'open',
            docType: 'election'
        };
        await ctx.stub.putState(electionId, Buffer.from(JSON.stringify(election)));
        return JSON.stringify(election);
    }

    async GetElection(ctx, electionId) {
        const electionData = await ctx.stub.getState(electionId);
        if (!electionData || electionData.length === 0) {
            throw new Error(`Election ${electionId} not found`);
        }
        return electionData.toString();
    }

    async CastVote(ctx, electionId, voter, candidate) {
        const electionData = await ctx.stub.getState(electionId);
        if (!electionData || electionData.length === 0) {
            throw new Error(`Election ${electionId} not found`);
        }
        const election = JSON.parse(electionData.toString());
        if (election.status !== 'open') {
            throw new Error(`Election ${electionId} is closed. No more votes can be cast.`);
        }
        if (!election.candidates.includes(candidate)) {
            throw new Error(`Candidate ${candidate} is not valid. Valid candidates: ${election.candidates.join(', ')}`);
        }
        const voteKey = `${electionId}_${voter}`;
        const existingVote = await ctx.stub.getState(voteKey);
        if (existingVote && existingVote.length > 0) {
            throw new Error(`Voter ${voter} has already voted. One person one vote!`);
        }
        const vote = {
            voteKey,
            electionId,
            voter,
            candidate,
            docType: 'vote'
        };
        await ctx.stub.putState(voteKey, Buffer.from(JSON.stringify(vote)));
        ctx.stub.setEvent('VoteCast', Buffer.from(JSON.stringify(vote)));
        return JSON.stringify(vote);
    }

    async HasVoted(ctx, electionId, voter) {
        const voteKey = `${electionId}_${voter}`;
        const existingVote = await ctx.stub.getState(voteKey);
        if (existingVote && existingVote.length > 0) {
            return 'true';
        }
        return 'false';
    }

    async GetResults(ctx, electionId) {
        const electionData = await ctx.stub.getState(electionId);
        if (!electionData || electionData.length === 0) {
            throw new Error(`Election ${electionId} not found`);
        }
        const election = JSON.parse(electionData.toString());
        const results = {};
        for (const candidate of election.candidates) {
            results[candidate] = 0;
        }
        const queryString = JSON.stringify({
            selector: { docType: 'vote', electionId: electionId }
        });
        const resultsIterator = await ctx.stub.getQueryResult(queryString);
        let result = await resultsIterator.next();
        while (!result.done) {
            const vote = JSON.parse(result.value.value.toString());
            if (results[vote.candidate] !== undefined) {
                results[vote.candidate]++;
            }
            result = await resultsIterator.next();
        }
        return JSON.stringify({
            electionId,
            electionName: election.electionName,
            status: election.status,
            results
        });
    }

    async CloseElection(ctx, electionId) {
        const electionData = await ctx.stub.getState(electionId);
        if (!electionData || electionData.length === 0) {
            throw new Error(`Election ${electionId} not found`);
        }
        const election = JSON.parse(electionData.toString());
        if (election.status === 'closed') {
            throw new Error(`Election ${electionId} is already closed`);
        }
        election.status = 'closed';
        await ctx.stub.putState(electionId, Buffer.from(JSON.stringify(election)));
        const results = {};
        for (const candidate of election.candidates) {
            results[candidate] = 0;
        }
        const queryString = JSON.stringify({
            selector: { docType: 'vote', electionId: electionId }
        });
        const resultsIterator = await ctx.stub.getQueryResult(queryString);
        let result = await resultsIterator.next();
        let totalVotes = 0;
        while (!result.done) {
            const vote = JSON.parse(result.value.value.toString());
            if (results[vote.candidate] !== undefined) {
                results[vote.candidate]++;
                totalVotes++;
            }
            result = await resultsIterator.next();
        }
        const sorted = Object.entries(results).sort((a, b) => b[1] - a[1]);
        const topVotes = sorted[0][1];
        const topCandidates = sorted.filter(c => c[1] === topVotes);
        let winnerInfo = {};
        if (topCandidates.length > 1) {
            const tiedNames = topCandidates.map(c => c[0]).join(' and ');
            winnerInfo = {
                result: 'TIE',
                tiedCandidates: topCandidates.map(c => c[0]),
                tiedVotes: topVotes,
                message: `It is a TIE! ${tiedNames} both received ${topVotes} votes each. A re-election is required.`
            };
        } else {
            const winner = sorted[0][0];
            const winnerVotes = sorted[0][1];
            const losers = sorted.slice(1).map(([name, votes]) => ({
                candidate: name,
                votes: votes,
                message: `${name} lost by ${winnerVotes - votes} vote(s) (received ${votes} votes)`
            }));
            winnerInfo = {
                result: 'WINNER',
                announcement: `The Chief Minister elected by the people of Tamil Nadu is ${winner} with ${winnerVotes} votes, winning by a margin of ${winnerVotes - sorted[1][1]} votes.`,
                winner: winner,
                winnerVotes: winnerVotes,
                margin: winnerVotes - sorted[1][1],
                allResults: results,
                losers: losers,
                totalVotes: totalVotes
            };
        }
        ctx.stub.setEvent('ElectionClosed', Buffer.from(JSON.stringify(winnerInfo)));
        return JSON.stringify(winnerInfo);
    }

    async GetWinner(ctx, electionId) {
        const electionData = await ctx.stub.getState(electionId);
        if (!electionData || electionData.length === 0) {
            throw new Error(`Election ${electionId} not found`);
        }
        const election = JSON.parse(electionData.toString());
        if (election.status !== 'closed') {
            throw new Error(`Election ${electionId} is still open. Close the election first.`);
        }
        const results = {};
        for (const candidate of election.candidates) {
            results[candidate] = 0;
        }
        const queryString = JSON.stringify({
            selector: { docType: 'vote', electionId: electionId }
        });
        const resultsIterator = await ctx.stub.getQueryResult(queryString);
        let result = await resultsIterator.next();
        let totalVotes = 0;
        while (!result.done) {
            const vote = JSON.parse(result.value.value.toString());
            if (results[vote.candidate] !== undefined) {
                results[vote.candidate]++;
                totalVotes++;
            }
            result = await resultsIterator.next();
        }
        const sorted = Object.entries(results).sort((a, b) => b[1] - a[1]);
        const topVotes = sorted[0][1];
        const topCandidates = sorted.filter(c => c[1] === topVotes);
        if (topCandidates.length > 1) {
            const tiedNames = topCandidates.map(c => c[0]).join(' and ');
            return JSON.stringify({
                result: 'TIE',
                tiedCandidates: topCandidates.map(c => c[0]),
                tiedVotes: topVotes,
                message: `It is a TIE! ${tiedNames} both received ${topVotes} votes. Re-election required.`
            });
        }
        const winner = sorted[0][0];
        const winnerVotes = sorted[0][1];
        const losers = sorted.slice(1).map(([name, votes]) => ({
            candidate: name,
            votes: votes,
            message: `${name} lost by ${winnerVotes - votes} vote(s) (received ${votes} votes)`
        }));
        return JSON.stringify({
            result: 'WINNER',
            announcement: `The Chief Minister elected by the people of Tamil Nadu is ${winner} with ${winnerVotes} votes.`,
            winner: winner,
            winnerVotes: winnerVotes,
            margin: winnerVotes - sorted[1][1],
            allResults: results,
            losers: losers,
            totalVotes: totalVotes
        });
    }

    async GetAllVotes(ctx, electionId) {
        const queryString = JSON.stringify({
            selector: { docType: 'vote', electionId: electionId }
        });
        const resultsIterator = await ctx.stub.getQueryResult(queryString);
        const votes = [];
        let result = await resultsIterator.next();
        while (!result.done) {
            votes.push(JSON.parse(result.value.value.toString()));
            result = await resultsIterator.next();
        }
        return JSON.stringify(votes);
    }

    async GetAllElections(ctx) {
        const results = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const item = JSON.parse(result.value.value.toString());
            if (item.docType === 'election') {
                results.push(item);
            }
            result = await iterator.next();
        }
        return JSON.stringify(results);
    }
}

module.exports = VotingSystem;